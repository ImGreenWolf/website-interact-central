import { parse } from 'qs-esm'
import type { CollectionConfig, Payload, PayloadRequest, Sort, Where } from 'payload'

import { getCollectionBySlug } from './schema'

type ExportPayload = Pick<Payload, 'find'>
export type ExportJoinedFields = Record<string, string[]>

export type ExportCollectionCSVArgs = {
  collectionSlug: string
  collections: CollectionConfig[]
  joinedFields?: ExportJoinedFields
  payload: ExportPayload
  queryString?: string
  req: PayloadRequest
  sort?: Sort
  where?: Where
}

type ExportField = {
  hasMany?: boolean
  label: string
  path: string
  relationTo?: string
  type?: string
}

type ExportColumn =
  | {
      field: ExportField
      header: string
      joinedSubfield?: undefined
    }
  | {
      field: ExportField
      header: string
      joinedSubfield: string
    }

export async function exportCollectionCSV(args: ExportCollectionCSVArgs) {
  if (!args.req.user) {
    throw new ExportError('Your session has expired. Sign in again.', 401)
  }

  const collection = getCollectionBySlug(args.collections, args.collectionSlug)

  if (!collection) {
    throw new ExportError(`Collection "${args.collectionSlug}" was not found.`, 404)
  }

  const query = parseExportQuery(args.queryString)
  const where = args.where ?? query.where
  const sort = args.sort ?? query.sort
  const fields = getExportFields(collection)
  const joinedFields = args.joinedFields || {}
  const columns = getExportColumns(fields, joinedFields)
  const result = await args.payload.find({
    collection: args.collectionSlug as never,
    depth: Object.keys(joinedFields).length > 0 ? 1 : 0,
    limit: 0,
    overrideAccess: false,
    pagination: false,
    req: args.req,
    sort,
    user: args.req.user,
    where,
  })

  return serializeCSV([
    columns.map((column) => column.header),
    ...result.docs.map((doc) => columns.map((column) => serializeExportColumn(doc, column))),
  ])
}

export class ExportError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ExportError'
    this.status = status
  }
}

function getExportFields(collection: CollectionConfig): ExportField[] {
  return [
    { label: 'ID', path: 'id' },
    ...collectExportFields(collection.fields).filter((field) => field.path !== 'password'),
  ]
}

function getExportColumns(
  fields: ExportField[],
  joinedFields: Record<string, string[]>,
): ExportColumn[] {
  return fields.flatMap((field) => {
    const subfields = joinedFields[field.path]

    if (!subfields) {
      return [
        {
          field,
          header: field.path,
        },
      ]
    }

    if (subfields.length === 0) {
      return [
        {
          field,
          header: field.path,
        },
      ]
    }

    return subfields.map((subfield) => ({
      field,
      header: `${field.path}.${subfield}`,
      joinedSubfield: subfield,
    }))
  })
}

function collectExportFields(
  fields: CollectionConfig['fields'],
  pathPrefix = '',
  labelPrefix: string[] = [],
): ExportField[] {
  return fields.flatMap((field) => {
    const fieldRecord = field as Record<string, unknown>
    const type = String(fieldRecord.type ?? '')

    if (type === 'tabs' && Array.isArray(fieldRecord.tabs)) {
      return fieldRecord.tabs.flatMap((tab) => {
        if (!tab || typeof tab !== 'object') return []

        const tabRecord = tab as Record<string, unknown>
        const tabName = typeof tabRecord.name === 'string' ? tabRecord.name : ''
        const tabLabel = getLabel(tabRecord.label, tabName)
        const tabFields = Array.isArray(tabRecord.fields)
          ? (tabRecord.fields as CollectionConfig['fields'])
          : []

        return collectExportFields(
          tabFields,
          tabName ? joinPath(pathPrefix, tabName) : pathPrefix,
          tabLabel ? [...labelPrefix, tabLabel] : labelPrefix,
        )
      })
    }

    if (type === 'row' || type === 'collapsible') {
      return Array.isArray(fieldRecord.fields)
        ? collectExportFields(
            fieldRecord.fields as CollectionConfig['fields'],
            pathPrefix,
            labelPrefix,
          )
        : []
    }

    const name = typeof fieldRecord.name === 'string' ? fieldRecord.name : ''

    if (type === 'group') {
      const groupLabel = getLabel(fieldRecord.label, name)

      return Array.isArray(fieldRecord.fields)
        ? collectExportFields(
            fieldRecord.fields as CollectionConfig['fields'],
            name ? joinPath(pathPrefix, name) : pathPrefix,
            groupLabel ? [...labelPrefix, groupLabel] : labelPrefix,
          )
        : []
    }

    if (!name || isBlockedField(fieldRecord)) return []

    const relationTo = fieldRecord.relationTo

    return [
      {
        hasMany: Boolean(fieldRecord.hasMany),
        label: [...labelPrefix, getLabel(fieldRecord.label, name) || name].join(' / '),
        path: joinPath(pathPrefix, name),
        relationTo:
          typeof relationTo === 'string'
            ? relationTo
            : Array.isArray(relationTo)
              ? relationTo.join(', ')
              : undefined,
        type,
      },
    ]
  })
}

function parseExportQuery(queryString: string | undefined): {
  sort?: Sort
  where?: Where
} {
  if (!queryString) return {}

  const parsed = parse(queryString, {
    ignoreQueryPrefix: true,
  }) as Record<string, unknown>
  const where = isRecord(parsed.where) ? (parsed.where as Where) : undefined
  const sort = typeof parsed.sort === 'string' ? (parsed.sort as Sort) : undefined

  return { sort, where }
}

function serializeCSV(rows: unknown[][]) {
  return rows
    .map((row) => row.map((cell) => escapeCSVCell(String(cell ?? ''))).join(','))
    .join('\n')
}

function escapeCSVCell(value: string) {
  if (!/[",\n\r]/.test(value)) return value

  return `"${value.replace(/"/g, '""')}"`
}

function serializeExportColumn(doc: unknown, column: ExportColumn) {
  const value = getDeepValue(doc, column.field.path)

  if (!column.joinedSubfield) return serializeValue(value)

  return serializeJoinedSubfield(value, column.joinedSubfield)
}

function serializeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => serializeSingleValue(item))
      .filter(Boolean)
      .join(', ')
  }

  return serializeSingleValue(value)
}

function serializeSingleValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>

    if (Array.isArray(record.docs)) {
      return record.docs
        .map((doc) => serializeSingleValue(doc))
        .filter(Boolean)
        .join(', ')
    }

    const id = record.id

    if (typeof id === 'string' || typeof id === 'number') return String(id)

    return JSON.stringify(value)
  }

  return String(value)
}

function serializeJoinedSubfield(value: unknown, subfieldPath: string) {
  const values = getJoinedRecords(value).map((record) =>
    serializeValue(getDeepValue(record, subfieldPath)),
  )

  return values.filter(Boolean).join(', ')
}

function getJoinedRecords(value: unknown): unknown[] {
  if (Array.isArray(value)) return value

  if (isRecord(value) && Array.isArray(value.docs)) return value.docs

  if (value === undefined || value === null) return []

  return [value]
}

function getDeepValue(target: unknown, path: string) {
  return path.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined

    return (current as Record<string, unknown>)[part]
  }, target)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getLabel(label: unknown, fallback: string) {
  if (typeof label === 'string') return label
  if (label === false) return fallback

  return fallback
    ? fallback
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (character) => character.toUpperCase())
    : ''
}

function joinPath(prefix: string, name: string) {
  return prefix ? `${prefix}.${name}` : name
}

function isBlockedField(field: Record<string, unknown>) {
  const admin =
    field.admin && typeof field.admin === 'object' ? (field.admin as Record<string, unknown>) : {}

  return Boolean(field.virtual || admin.hidden)
}
