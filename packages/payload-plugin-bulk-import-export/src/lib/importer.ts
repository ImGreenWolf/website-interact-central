import type { CollectionConfig, Payload, PayloadRequest, Where } from 'payload'

import type { BulkUploadResolver } from '../types'
import { getCell, parseCSV } from './csv'
import {
  type CollectionUploadSchema,
  type ImportableField,
  type MatchFieldOption,
  getCollectionBySlug,
  getCollectionUploadSchema,
  getDefaultMatchSelection,
  getFieldByPath,
  hasHeader,
  suggestMappings,
} from './schema'

export type BulkUploadMode = 'create' | 'update' | 'upsert'

export type BulkUploadMapping = Record<string, string>

export type BulkUploadIssue = {
  field?: string
  message: string
  row: number
}

export type BulkUploadInspectResult = CollectionUploadSchema & {
  defaultMatchColumn: string
  defaultMatchField: string
  delimiter: ',' | ';'
  headers: string[]
  sampleRows: Record<string, string>[]
  suggestedMapping: BulkUploadMapping
}

export type BulkUploadPreviewRow = {
  errors: BulkUploadIssue[]
  matchValue: string
  operation: 'create' | 'skip' | 'update'
  row: number
  skippedReason?: string
}

export type BulkUploadPreviewResult = {
  errors: BulkUploadIssue[]
  rows: BulkUploadPreviewRow[]
  summary: {
    create: number
    errors: number
    skip: number
    update: number
  }
}

export type BulkUploadImportResult = {
  created: { id: string; row: number }[]
  errors: BulkUploadIssue[]
  skipped: { reason: string; row: number }[]
  updated: { id: string; row: number }[]
}

type ImportPayload = {
  config?: { collections?: CollectionConfig[] }
  create: (...args: any[]) => Promise<any>
  find: (...args: any[]) => Promise<any>
  findByID: (...args: any[]) => Promise<any>
  update: (...args: any[]) => Promise<any>
}

type UploadResolverCache = Map<string, Promise<null | string | undefined>>

type PreparedRow = {
  data: Record<string, unknown>
  errors: BulkUploadIssue[]
  existingID?: string
  matchValue: string
  operation: 'create' | 'skip' | 'update'
  row: number
  skippedReason?: string
}

export async function inspectBulkUpload(args: {
  collectionSlug: string
  collections: CollectionConfig[]
  csv: string
}): Promise<BulkUploadInspectResult> {
  const collection = getKnownCollection(args.collections, args.collectionSlug)
  const parsed = parseCSV(args.csv)

  if (!parsed.parsed) {
    throw new BulkUploadError('CSV could not be parsed.', 400, parsed.errors)
  }

  const schema = getCollectionUploadSchema(collection)
  const defaultMatch = getDefaultMatchSelection(
    parsed.parsed.headers,
    schema.matchFieldOptions,
  )

  return {
    ...schema,
    defaultMatchColumn: defaultMatch.matchColumn,
    defaultMatchField: defaultMatch.matchField,
    delimiter: parsed.parsed.delimiter,
    headers: parsed.parsed.headers,
    sampleRows: parsed.parsed.rows
      .slice(0, 5)
      .map((row) =>
        Object.fromEntries(
          parsed.parsed!.headers.map((header, index) => [
            header,
            row.cells[index] ?? '',
          ]),
        ),
      ),
    suggestedMapping: suggestMappings(parsed.parsed.headers, schema.fields),
  }
}

export async function previewBulkUpload(args: {
  collectionSlug: string
  collections: CollectionConfig[]
  csv: string
  mapping: BulkUploadMapping
  matchColumn: string
  matchField: string
  mode: BulkUploadMode
  payload: ImportPayload
  req: PayloadRequest
  uploadResolver?: BulkUploadResolver
}): Promise<BulkUploadPreviewResult> {
  const prepared = await prepareRows({ ...args, createUploads: false })

  return {
    errors: prepared.flatMap((row) => row.errors),
    rows: prepared.map((row) => ({
      errors: row.errors,
      matchValue: row.matchValue,
      operation: row.operation,
      row: row.row,
      skippedReason: row.skippedReason,
    })),
    summary: summarizeRows(prepared),
  }
}

export async function importBulkUpload(args: {
  collectionSlug: string
  collections: CollectionConfig[]
  csv: string
  mapping: BulkUploadMapping
  matchColumn: string
  matchField: string
  mode: BulkUploadMode
  payload: ImportPayload
  req: PayloadRequest
  rowNumbers?: number[]
  uploadResolver?: BulkUploadResolver
}): Promise<BulkUploadImportResult> {
  const prepared = await prepareRows({ ...args, createUploads: true })
  const result: BulkUploadImportResult = {
    created: [],
    errors: prepared.flatMap((row) => row.errors),
    skipped: [],
    updated: [],
  }

  for (const row of prepared) {
    if (row.errors.length > 0) continue

    if (row.operation === 'skip') {
      result.skipped.push({
        reason: row.skippedReason || 'Skipped.',
        row: row.row,
      })
      continue
    }

    try {
      if (row.operation === 'update') {
        if (!row.existingID) {
          result.errors.push({
            message: 'Matched document could not be resolved for update.',
            row: row.row,
          })
          continue
        }

        const updated = await args.payload.update({
          collection: args.collectionSlug,
          data: row.data,
          id: row.existingID,
          overrideAccess: false,
          req: args.req,
          user: args.req.user,
        })

        result.updated.push({ id: String(updated.id), row: row.row })
        continue
      }

      const created = await args.payload.create({
        collection: args.collectionSlug,
        data: row.data,
        overrideAccess: false,
        req: args.req,
        user: args.req.user,
      })

      result.created.push({ id: String(created.id), row: row.row })
    } catch (error) {
      result.errors.push({
        message:
          error instanceof Error
            ? error.message
            : `Row could not be ${row.operation === 'update' ? 'updated' : 'created'}.`,
        row: row.row,
      })
    }
  }

  return result
}

export class BulkUploadError extends Error {
  issues: BulkUploadIssue[]
  status: number

  constructor(message: string, status = 400, issues: BulkUploadIssue[] = []) {
    super(message)
    this.name = 'BulkUploadError'
    this.status = status
    this.issues = issues
  }
}

async function prepareRows(args: {
  collectionSlug: string
  collections: CollectionConfig[]
  createUploads: boolean
  csv: string
  mapping: BulkUploadMapping
  matchColumn: string
  matchField: string
  mode: BulkUploadMode
  payload: ImportPayload
  req: PayloadRequest
  rowNumbers?: number[]
  uploadResolver?: BulkUploadResolver
}): Promise<PreparedRow[]> {
  if (!args.req.user) {
    throw new BulkUploadError('Your session has expired. Sign in again.', 401)
  }

  const collection = getKnownCollection(args.collections, args.collectionSlug)
  const parsed = parseCSV(args.csv)

  if (!parsed.parsed) {
    throw new BulkUploadError('CSV could not be parsed.', 400, parsed.errors)
  }

  const schema = getCollectionUploadSchema(collection)
  const matchField = getMatchField(schema.matchFieldOptions, args.matchField)

  validateRequestShape({
    headers: parsed.parsed.headers,
    mapping: args.mapping,
    matchColumn: args.matchColumn,
    matchField,
    mode: args.mode,
    schema,
  })

  const duplicateRows = findDuplicateMatchRows({
    headers: parsed.parsed.headers,
    matchColumn: args.matchColumn,
    rows: parsed.parsed.rows,
  })
  const preparedRows: PreparedRow[] = []
  const uploadResolverCache: UploadResolverCache = new Map()
  const rowNumberFilter =
    args.rowNumbers && args.rowNumbers.length > 0
      ? new Set(args.rowNumbers)
      : null

  for (const row of parsed.parsed.rows) {
    if (rowNumberFilter && !rowNumberFilter.has(row.rowNumber)) continue

    const rowErrors: BulkUploadIssue[] = []
    const matchValue = getCell(row, parsed.parsed.headers, args.matchColumn)
    const duplicateRow = duplicateRows.get(row.rowNumber)

    if (!matchValue) {
      rowErrors.push({
        field: args.matchField,
        message: `Match column "${args.matchColumn}" is required.`,
        row: row.rowNumber,
      })
    }

    if (duplicateRow !== undefined) {
      rowErrors.push({
        field: args.matchField,
        message: `Match value duplicates row ${duplicateRow} in this CSV.`,
        row: row.rowNumber,
      })
    }

    const existing = matchValue
      ? await findExistingDocument({
          collectionSlug: args.collectionSlug,
          matchField,
          payload: args.payload,
          req: args.req,
          value: matchValue,
        })
      : null
    const operation = getPlannedOperation(args.mode, Boolean(existing))
    const data = await buildRowData({
      collectionSlug: args.collectionSlug,
      createUploads: args.createUploads && operation !== 'skip',
      fields: schema.fields,
      headers: parsed.parsed.headers,
      mapping: args.mapping,
      operation,
      payload: args.payload,
      req: args.req,
      row,
      rowErrors,
      uploadResolver: args.uploadResolver,
      uploadResolverCache,
    })

    if (operation === 'create') {
      validateRequiredFields({
        data,
        fields: schema.fields,
        row: row.rowNumber,
        rowErrors,
        skippedRequiredFields: schema.skippedRequiredFields,
      })
    }

    preparedRows.push({
      data,
      errors: rowErrors,
      existingID: existing?.id ? String(existing.id) : undefined,
      matchValue,
      operation,
      row: row.rowNumber,
      skippedReason: getSkippedReason(args.mode, Boolean(existing)),
    })
  }

  return preparedRows
}

async function buildRowData(args: {
  collectionSlug: string
  createUploads: boolean
  fields: ImportableField[]
  headers: string[]
  mapping: BulkUploadMapping
  operation: 'create' | 'skip' | 'update'
  payload: ImportPayload
  req: PayloadRequest
  row: { cells: string[]; rowNumber: number }
  rowErrors: BulkUploadIssue[]
  uploadResolver?: BulkUploadResolver
  uploadResolverCache: UploadResolverCache
}) {
  const data: Record<string, unknown> = {}

  for (const field of args.fields) {
    if (
      field.path === 'password' &&
      args.collectionSlug === 'users' &&
      args.operation === 'update'
    ) {
      continue
    }

    const header = args.mapping[field.path]
    if (!header) continue

    const rawValue = getCell(args.row, args.headers, header)
    if (!rawValue) continue

    const value = await coerceValue({
      createUploads: args.createUploads && args.rowErrors.length === 0,
      field,
      payload: args.payload,
      req: args.req,
      row: args.row.rowNumber,
      rowErrors: args.rowErrors,
      uploadResolver: args.uploadResolver,
      uploadResolverCache: args.uploadResolverCache,
      value: rawValue,
    })

    if (value !== undefined) setDeepValue(data, field.path, value)
  }

  return data
}

async function coerceValue(args: {
  createUploads: boolean
  field: ImportableField
  payload: ImportPayload
  req: PayloadRequest
  row: number
  rowErrors: BulkUploadIssue[]
  uploadResolver?: BulkUploadResolver
  uploadResolverCache: UploadResolverCache
  value: string
}) {
  const { field, value } = args

  if (
    field.hasMany &&
    (field.type === 'relationship' ||
      field.type === 'select' ||
      field.type === 'upload')
  ) {
    const values = splitMany(value)
    const resolvedValues: unknown[] = []

    for (const item of values) {
      const resolved = await coerceSingleValue({ ...args, value: item })
      if (resolved !== undefined) resolvedValues.push(resolved)
    }

    return resolvedValues
  }

  return coerceSingleValue(args)
}

async function coerceSingleValue(args: {
  createUploads: boolean
  field: ImportableField
  payload: ImportPayload
  req: PayloadRequest
  row: number
  rowErrors: BulkUploadIssue[]
  uploadResolver?: BulkUploadResolver
  uploadResolverCache: UploadResolverCache
  value: string
}) {
  const { field, value } = args

  if (field.type === 'text' || field.type === 'textarea') return value

  if (field.type === 'email') {
    const email = value.toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      args.rowErrors.push({
        field: field.path,
        message: `${field.label} must be a valid email address.`,
        row: args.row,
      })
      return undefined
    }

    return email
  }

  if (field.type === 'number') {
    const number = Number(value)

    if (!Number.isFinite(number)) {
      args.rowErrors.push({
        field: field.path,
        message: `${field.label} must be a number.`,
        row: args.row,
      })
      return undefined
    }

    return number
  }

  if (field.type === 'checkbox') {
    const normalized = value.trim().toLocaleLowerCase('ro')

    if (['true', '1', 'yes', 'y', 'da'].includes(normalized)) return true
    if (['false', '0', 'no', 'n', 'nu'].includes(normalized)) return false

    args.rowErrors.push({
      field: field.path,
      message: `${field.label} must be true or false.`,
      row: args.row,
    })
    return undefined
  }

  if (field.type === 'date') {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      args.rowErrors.push({
        field: field.path,
        message: `${field.label} must be a valid date.`,
        row: args.row,
      })
      return undefined
    }

    return date.toISOString()
  }

  if (field.type === 'select') {
    const option = field.options?.find((candidate) => candidate.value === value)

    if (!option) {
      args.rowErrors.push({
        field: field.path,
        message: `${field.label} must be one of: ${field.options?.map((candidate) => candidate.value).join(', ') || 'no options'}.`,
        row: args.row,
      })
      return undefined
    }

    return option.value
  }

  if (field.type === 'upload') {
    if (!field.relationTo) return undefined

    const resolvedUpload = await resolveUploadValue({
      createUploads: args.createUploads,
      field,
      payload: args.payload,
      req: args.req,
      uploadResolver: args.uploadResolver,
      uploadResolverCache: args.uploadResolverCache,
      value,
    })

    if (resolvedUpload !== undefined) {
      if (resolvedUpload) return resolvedUpload

      args.rowErrors.push({
        field: field.path,
        message: `${field.label} upload "${value}" could not be resolved.`,
        row: args.row,
      })
      return undefined
    }

    const resolvedID = await resolveRelatedID({
      collectionSlug: field.relationTo,
      payload: args.payload,
      req: args.req,
      value,
    })

    if (!resolvedID) {
      args.rowErrors.push({
        field: field.path,
        message: `${field.label} reference "${value}" was not found.`,
        row: args.row,
      })
      return undefined
    }

    return resolvedID
  }

  if (field.type === 'relationship') {
    if (!field.relationTo) return undefined

    const resolvedID = await resolveRelatedID({
      collectionSlug: field.relationTo,
      payload: args.payload,
      req: args.req,
      value,
    })

    if (!resolvedID) {
      args.rowErrors.push({
        field: field.path,
        message: `${field.label} reference "${value}" was not found.`,
        row: args.row,
      })
      return undefined
    }

    return resolvedID
  }

  return undefined
}

async function resolveUploadValue(args: {
  createUploads: boolean
  field: ImportableField
  payload: ImportPayload
  req: PayloadRequest
  uploadResolver?: BulkUploadResolver
  uploadResolverCache: UploadResolverCache
  value: string
}) {
  if (!args.uploadResolver || !args.field.relationTo) return undefined

  const cacheKey = [
    args.field.relationTo,
    args.createUploads ? 'import' : 'preview',
    args.value,
  ].join(':')
  const cached = args.uploadResolverCache.get(cacheKey)
  if (cached) return cached

  const resolved = args.uploadResolver({
    createUploads: args.createUploads,
    payload: args.payload as Payload,
    relationTo: args.field.relationTo,
    req: args.req,
    value: args.value,
  })
  args.uploadResolverCache.set(cacheKey, resolved)

  return resolved
}

async function resolveRelatedID(args: {
  collectionSlug: string
  payload: ImportPayload
  req: PayloadRequest
  value: string
}) {
  const collection = args.payload.config?.collections
    ? getCollectionBySlug(args.payload.config.collections, args.collectionSlug)
    : undefined
  const relatedSchema = collection
    ? getCollectionUploadSchema(collection)
    : undefined
  const lookupFields = getLookupFields(relatedSchema)
  const where = {
    or: lookupFields.map((field) => ({
      [field.path]: {
        equals: coerceMatchValue(field, args.value),
      },
    })),
  } satisfies Where

  const result = await args.payload.find({
    collection: args.collectionSlug,
    depth: 0,
    limit: 1,
    overrideAccess: false,
    req: args.req,
    user: args.req.user,
    where,
  })

  return result.docs[0]?.id ? String(result.docs[0].id) : null
}

async function findExistingDocument(args: {
  collectionSlug: string
  matchField: MatchFieldOption
  payload: ImportPayload
  req: PayloadRequest
  value: string
}) {
  try {
    if (args.matchField.path === 'id') {
      return await args.payload.findByID({
        collection: args.collectionSlug,
        depth: 0,
        id: args.value,
        overrideAccess: false,
        req: args.req,
        user: args.req.user,
      })
    }

    const result = await args.payload.find({
      collection: args.collectionSlug,
      depth: 0,
      limit: 1,
      overrideAccess: false,
      req: args.req,
      user: args.req.user,
      where: {
        [args.matchField.path]: {
          equals: coerceMatchValue(args.matchField, args.value),
        },
      } as Where,
    })

    return result.docs[0] ?? null
  } catch {
    return null
  }
}

function validateRequestShape(args: {
  headers: string[]
  mapping: BulkUploadMapping
  matchColumn: string
  matchField: MatchFieldOption
  mode: BulkUploadMode
  schema: CollectionUploadSchema
}) {
  if (!['create', 'update', 'upsert'].includes(args.mode)) {
    throw new BulkUploadError('Choose a valid import mode.')
  }

  if (!args.matchColumn || !hasHeader(args.headers, args.matchColumn)) {
    throw new BulkUploadError('Choose a valid match column.')
  }

  Object.entries(args.mapping).forEach(([path, header]) => {
    if (!header) return

    if (!getFieldByPath(args.schema.fields, path)) {
      throw new BulkUploadError(`Field "${path}" is not importable.`)
    }

    if (!hasHeader(args.headers, header)) {
      throw new BulkUploadError(`Column "${header}" was not found in the CSV.`)
    }
  })
}

function validateRequiredFields(args: {
  data: Record<string, unknown>
  fields: ImportableField[]
  row: number
  rowErrors: BulkUploadIssue[]
  skippedRequiredFields: { label: string; path: string; type: string }[]
}) {
  args.fields.forEach((field) => {
    if (!field.required || field.defaultValue !== undefined) return

    const value = getDeepValue(args.data, field.path)
    const missing = value === undefined || value === null || value === ''

    if (missing) {
      args.rowErrors.push({
        field: field.path,
        message: `${field.label} is required.`,
        row: args.row,
      })
    }
  })

  args.skippedRequiredFields.forEach((field) => {
    args.rowErrors.push({
      field: field.path,
      message: `${field.label} is required but ${field.type} fields are not supported by bulk upload yet.`,
      row: args.row,
    })
  })
}

function findDuplicateMatchRows(args: {
  headers: string[]
  matchColumn: string
  rows: { cells: string[]; rowNumber: number }[]
}) {
  const seen = new Map<string, number>()
  const duplicates = new Map<number, number>()

  args.rows.forEach((row) => {
    const value = getCell(row, args.headers, args.matchColumn)
      .trim()
      .toLocaleLowerCase('ro')

    if (!value) return

    const previousRow = seen.get(value)

    if (previousRow !== undefined) {
      duplicates.set(row.rowNumber, previousRow)
      return
    }

    seen.set(value, row.rowNumber)
  })

  return duplicates
}

function getPlannedOperation(mode: BulkUploadMode, hasExisting: boolean) {
  if (mode === 'create') return hasExisting ? 'skip' : 'create'
  if (mode === 'update') return hasExisting ? 'update' : 'skip'

  return hasExisting ? 'update' : 'create'
}

function getSkippedReason(mode: BulkUploadMode, hasExisting: boolean) {
  if (mode === 'create' && hasExisting)
    return 'A matching document already exists.'
  if (mode === 'update' && !hasExisting)
    return 'No matching document was found.'

  return undefined
}

function summarizeRows(rows: PreparedRow[]) {
  return rows.reduce(
    (summary, row) => {
      if (row.errors.length > 0) summary.errors += 1
      else summary[row.operation] += 1

      return summary
    },
    { create: 0, errors: 0, skip: 0, update: 0 },
  )
}

function getKnownCollection(collections: CollectionConfig[], slug: string) {
  const collection = getCollectionBySlug(collections, slug)

  if (!collection) {
    throw new BulkUploadError(`Collection "${slug}" was not found.`, 404)
  }

  return collection
}

function getMatchField(options: MatchFieldOption[], path: string) {
  const matchField = options.find((option) => option.path === path)

  if (!matchField) {
    throw new BulkUploadError(`Field "${path}" cannot be used to match rows.`)
  }

  return matchField
}

function getLookupFields(
  schema: CollectionUploadSchema | undefined,
): MatchFieldOption[] {
  if (!schema) return [{ label: 'ID', path: 'id', type: 'id' }]

  return schema.matchFieldOptions.length > 0
    ? schema.matchFieldOptions
    : [{ label: 'ID', path: 'id', type: 'id' }]
}

function coerceMatchValue(field: MatchFieldOption, value: string) {
  if (field.type === 'number') {
    const number = Number(value)

    return Number.isFinite(number) ? number : value
  }

  if (field.type === 'date') {
    const date = new Date(value)

    return Number.isNaN(date.getTime()) ? value : date.toISOString()
  }

  if (field.type === 'email') return value.toLowerCase()

  return value
}

function splitMany(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function setDeepValue(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
) {
  const parts = path.split('.')
  let current = target

  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      current[part] = value
      return
    }

    const next = current[part]

    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[part] = {}
    }

    current = current[part] as Record<string, unknown>
  })
}

function getDeepValue(target: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object' || Array.isArray(current))
      return undefined

    return (current as Record<string, unknown>)[part]
  }, target)
}
