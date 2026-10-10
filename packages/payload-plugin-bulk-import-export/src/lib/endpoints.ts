import type { CollectionConfig, Endpoint, PayloadRequest, Sort, Where } from 'payload'

import type { NormalizedBulkImportExportPluginConfig } from '../types'
import {
  ExportError,
  type ExportCollectionCSVArgs,
  type ExportTransposeConfig,
  exportCollectionCSV,
} from './exporter'
import {
  type BulkUploadMapping,
  type BulkUploadMode,
  BulkUploadError,
  importBulkUpload,
  inspectBulkUpload,
  previewBulkUpload,
} from './importer'

type BulkUploadAction = 'export' | 'import' | 'inspect' | 'preview'

export function createBulkImportExportEndpoints(
  collections: CollectionConfig[],
  options: NormalizedBulkImportExportPluginConfig,
): Endpoint[] {
  const endpointBase = options.endpointBase.replace(/\/$/, '')

  return [
    {
      handler: (req) => handleBulkUploadRequest(req, collections, options, 'inspect'),
      method: 'post',
      path: `${endpointBase}/inspect`,
    },
    {
      handler: (req) => handleBulkUploadRequest(req, collections, options, 'preview'),
      method: 'post',
      path: `${endpointBase}/preview`,
    },
    {
      handler: (req) => handleBulkUploadRequest(req, collections, options, 'import'),
      method: 'post',
      path: `${endpointBase}/import`,
    },
    {
      handler: (req) => handleBulkUploadRequest(req, collections, options, 'export'),
      method: 'post',
      path: `${endpointBase}/export`,
    },
  ]
}

async function handleBulkUploadRequest(
  req: PayloadRequest,
  collections: CollectionConfig[],
  options: NormalizedBulkImportExportPluginConfig,
  action: BulkUploadAction,
) {
  try {
    const input =
      action === 'export' ? await readExportJSON(req) : await readBulkUploadForm(req, action)

    assertCollectionEnabled(input.collection, options.collections)

    if (action === 'export') {
      const exportInput = input as Awaited<ReturnType<typeof readExportJSON>>
      const exportArgs: ExportCollectionCSVArgs = {
        collectionSlug: exportInput.collection,
        collections,
        joinedFields: exportInput.joinedFields,
        payload: req.payload,
        queryString: exportInput.queryString,
        req,
        sort: exportInput.sort,
        transpose: exportInput.transpose,
        where: exportInput.where,
      }
      const csv = await exportCollectionCSV(exportArgs)

      return new Response(csv, {
        headers: {
          'Content-Disposition': `attachment; filename="${exportInput.collection}.csv"`,
          'Content-Type': 'text/csv; charset=utf-8',
        },
      })
    }

    const bulkInput = input as Awaited<ReturnType<typeof readBulkUploadForm>>

    if (action === 'inspect') {
      const result = await inspectBulkUpload({
        collectionSlug: bulkInput.collection,
        collections,
        csv: bulkInput.csv,
      })

      return Response.json(result)
    }

    const uploadInput = bulkInput as typeof bulkInput & {
      mapping: BulkUploadMapping
      matchColumn: string
      matchField: string
      mode: BulkUploadMode
      rowNumbers?: number[]
    }
    const args = {
      collectionSlug: uploadInput.collection,
      collections,
      csv: uploadInput.csv,
      mapping: uploadInput.mapping,
      matchColumn: uploadInput.matchColumn,
      matchField: uploadInput.matchField,
      mode: uploadInput.mode,
      payload: req.payload,
      req,
      rowNumbers: uploadInput.rowNumbers,
      uploadResolver: options.uploadResolver,
    }

    if (action === 'preview') {
      return Response.json(await previewBulkUpload(args))
    }

    const result = await importBulkUpload(args)
    const message = [
      `${result.created.length} created`,
      `${result.updated.length} updated`,
      `${result.skipped.length} skipped`,
      `${result.errors.length} errors`,
    ].join(', ')
    const status =
      result.created.length + result.updated.length === 0 && result.errors.length > 0 ? 400 : 200

    return Response.json({ message, ...result }, { status })
  } catch (error) {
    if (error instanceof BulkUploadError) {
      return Response.json(
        {
          errors: error.issues,
          message: error.message,
        },
        { status: error.status },
      )
    }

    if (error instanceof ExportError) {
      return Response.json(
        {
          message: error.message,
        },
        { status: error.status },
      )
    }

    return Response.json(
      {
        message: error instanceof Error ? error.message : 'Bulk import/export request failed.',
      },
      { status: 500 },
    )
  }
}

async function readBulkUploadForm(req: PayloadRequest, action: BulkUploadAction) {
  if (!req.user) {
    throw new BulkUploadError('Your session has expired. Sign in again.', 401)
  }

  if (isJSONRequest(req)) {
    return readBulkUploadJSON(req, action)
  }

  if (typeof req.formData !== 'function') {
    throw new BulkUploadError('CSV upload is not available for this request.')
  }

  const formData = await req.formData()
  const collection = getFormString(formData, 'collection')
  const file = formData.get('file')

  if (!collection) {
    throw new BulkUploadError('Choose a collection.')
  }

  if (!isUploadedFile(file) || file.size === 0) {
    throw new BulkUploadError('Select a CSV file to upload.')
  }

  if (!isCSVFile(file)) {
    throw new BulkUploadError('Upload a .csv file.')
  }

  const base = {
    collection,
    csv: await file.text(),
  }

  if (action === 'inspect') return base

  return {
    ...base,
    mapping: parseJSONFormValue<BulkUploadMapping>(formData, 'mapping', {}),
    matchColumn: getFormString(formData, 'matchColumn'),
    matchField: getFormString(formData, 'matchField'),
    mode: normalizeMode(getFormString(formData, 'mode')),
    rowNumbers: normalizeRowNumbers(parseJSONFormValue<unknown[]>(formData, 'rowNumbers', [])),
  }
}

async function readBulkUploadJSON(req: PayloadRequest, action: BulkUploadAction) {
  if (typeof req.json !== 'function') {
    throw new BulkUploadError('CSV upload is not available for this request.')
  }

  const data = (await req.json()) as Record<string, unknown>
  const collection = getRecordString(data, 'collection')
  const fileName = getRecordString(data, 'fileName')
  const csv = decodeBase64CSV(getRecordString(data, 'csvBase64')) || getRecordString(data, 'csv')

  if (!collection) {
    throw new BulkUploadError('Choose a collection.')
  }

  if (!csv) {
    throw new BulkUploadError('Select a CSV file to upload.')
  }

  if (fileName && !fileName.toLowerCase().endsWith('.csv')) {
    throw new BulkUploadError('Upload a .csv file.')
  }

  const base = {
    collection,
    csv,
  }

  if (action === 'inspect') return base

  return {
    ...base,
    mapping: getRecordObject<BulkUploadMapping>(data, 'mapping', {}),
    matchColumn: getRecordString(data, 'matchColumn'),
    matchField: getRecordString(data, 'matchField'),
    mode: normalizeMode(getRecordString(data, 'mode')),
    rowNumbers: normalizeRowNumbers(data.rowNumbers),
  }
}

async function readExportJSON(req: PayloadRequest) {
  if (!req.user) {
    throw new BulkUploadError('Your session has expired. Sign in again.', 401)
  }

  if (!isJSONRequest(req) || typeof req.json !== 'function') {
    throw new BulkUploadError('Export requires a JSON request.')
  }

  const data = (await req.json()) as Record<string, unknown>
  const collection = getRecordString(data, 'collection')

  if (!collection) {
    throw new BulkUploadError('Choose a collection.')
  }

  return {
    collection,
    joinedFields: normalizeJoinedFields(data.joinedFields),
    queryString: getRecordString(data, 'queryString'),
    sort: typeof data.sort === 'string' ? (data.sort as Sort) : undefined,
    transpose: normalizeTransposeConfig(data.transpose),
    where: getRecordObject<undefined | Where>(data, 'where', undefined),
  }
}

function assertCollectionEnabled(collection: string, enabledCollections: string[]) {
  if (!enabledCollections.includes(collection)) {
    throw new BulkUploadError(
      `Collection "${collection}" is not enabled for bulk import/export.`,
      404,
    )
  }
}

function isJSONRequest(req: PayloadRequest) {
  return req.headers.get('content-type')?.toLowerCase().includes('application/json') ?? false
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key)

  return typeof value === 'string' ? value : ''
}

function getRecordString(record: Record<string, unknown>, key: string) {
  const value = record[key]

  return typeof value === 'string' ? value : ''
}

function getRecordObject<TValue>(record: Record<string, unknown>, key: string, fallback: TValue) {
  const value = record[key]

  return value && typeof value === 'object' && !Array.isArray(value) ? (value as TValue) : fallback
}

function normalizeJoinedFields(value: unknown) {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .filter((item): item is string => typeof item === 'string' && item.length > 0)
        .map((field) => [field, []]),
    )
  }

  if (!value || typeof value !== 'object') return {}

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([field]) => field.length > 0)
      .map(([field, subfields]) => [
        field,
        Array.isArray(subfields)
          ? subfields.filter(
              (subfield): subfield is string => typeof subfield === 'string' && subfield.length > 0,
            )
          : [],
      ]),
  )
}

function normalizeTransposeConfig(value: unknown): ExportTransposeConfig | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const record = value as Record<string, unknown>

  return {
    columnBy: typeof record.columnBy === 'string' ? record.columnBy : '',
    columnHeaderField: typeof record.columnHeaderField === 'string' ? record.columnHeaderField : '',
    enabled: record.enabled === true,
    groupBy: typeof record.groupBy === 'string' ? record.groupBy : '',
    valueField: typeof record.valueField === 'string' ? record.valueField : '',
  }
}

function decodeBase64CSV(value: string) {
  if (!value) return ''

  try {
    return Buffer.from(value, 'base64').toString('utf8')
  } catch {
    throw new BulkUploadError('CSV upload could not be decoded.')
  }
}

function normalizeRowNumbers(value: unknown) {
  if (!Array.isArray(value)) return undefined

  const rowNumbers = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 1)

  return rowNumbers.length > 0 ? rowNumbers : undefined
}

function parseJSONFormValue<TValue>(formData: FormData, key: string, fallback: TValue) {
  const value = getFormString(formData, key)

  if (!value) return fallback

  try {
    return JSON.parse(value) as TValue
  } catch {
    throw new BulkUploadError(`Invalid ${key} data.`)
  }
}

function normalizeMode(value: string): BulkUploadMode {
  if (value === 'create' || value === 'update' || value === 'upsert') {
    return value
  }

  throw new BulkUploadError('Choose a valid import mode.')
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File
}

function isCSVFile(file: File) {
  const fileName = file.name.toLowerCase()
  const mimeType = file.type.toLowerCase()

  return (
    fileName.endsWith('.csv') ||
    mimeType === 'text/csv' ||
    mimeType === 'text/plain' ||
    mimeType === 'application/vnd.ms-excel'
  )
}
