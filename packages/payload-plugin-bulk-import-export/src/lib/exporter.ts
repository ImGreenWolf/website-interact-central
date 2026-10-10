import { parse } from 'qs-esm'
import type { CollectionConfig, Payload, PayloadRequest, Sort, Where } from 'payload'

import { getCollectionBySlug } from './schema'

type ExportPayload = Pick<Payload, 'find'>
export type ExportJoinedFields = Record<string, string[]>

export type ExportTransposeConfig = {
  columnBy: string
  columnHeaderField: string
  enabled: boolean
  groupBy: string
  valueField: string
}

export type ExportCollectionCSVArgs = {
  collectionSlug: string
  collections: CollectionConfig[]
  joinedFields?: ExportJoinedFields
  payload: ExportPayload
  queryString?: string
  req: PayloadRequest
  sort?: Sort
  transpose?: ExportTransposeConfig
  where?: Where
}

type ExportField = {
  hasMany?: boolean
  label: string
  path: string
  relationSlug?: string
  relationTo?: string
  type?: string
}

type TransposeDynamicColumn = {
  header: string
  key: string
  valueSubfield?: string
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
  const isTransposedExport = Boolean(args.transpose?.enabled)
  const result = await args.payload.find({
    collection: args.collectionSlug as never,
    depth: isTransposedExport || Object.keys(joinedFields).length > 0 ? 1 : 0,
    limit: 0,
    overrideAccess: false,
    pagination: false,
    req: args.req,
    sort,
    user: args.req.user,
    where,
  })

  if (isTransposedExport && args.transpose) {
    return serializeTransposedCSV({
      collections: args.collections,
      docs: result.docs,
      fields,
      joinedFields,
      transpose: args.transpose,
    })
  }

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
    ...(collection.timestamps === false
      ? []
      : [
          { label: 'Created At', path: 'createdAt', type: 'date' },
          { label: 'Updated At', path: 'updatedAt', type: 'date' },
        ]),
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

function serializeTransposedCSV(args: {
  collections: CollectionConfig[]
  docs: unknown[]
  fields: ExportField[]
  joinedFields: ExportJoinedFields
  transpose: ExportTransposeConfig
}) {
  const groupField = getExportFieldByPath(args.fields, args.transpose.groupBy)
  const columnField = getExportFieldByPath(args.fields, args.transpose.columnBy)
  const valueField = getExportFieldByPath(args.fields, args.transpose.valueField)

  if (!groupField) {
    throw new ExportError(`Transpose group field "${args.transpose.groupBy}" was not found.`)
  }

  if (!columnField) {
    throw new ExportError(`Transpose column field "${args.transpose.columnBy}" was not found.`)
  }

  if (!valueField) {
    throw new ExportError(`Transpose value field "${args.transpose.valueField}" was not found.`)
  }

  if (!args.transpose.columnHeaderField) {
    throw new ExportError('Choose a transpose column header field.')
  }

  const leadingColumns = getTransposeLeadingColumns(groupField, args.joinedFields)
  const valueSubfields = getTransposeValueSubfields({
    collections: args.collections,
    joinedFields: args.joinedFields,
    valueField,
  })
  const dynamicColumns: TransposeDynamicColumn[] = []
  const dynamicColumnKeys = new Set<string>()
  const rowMap = new Map<
    string,
    {
      groupValue: unknown
      values: Map<string, string[]>
    }
  >()

  for (const doc of args.docs) {
    const groupValue = getDeepValue(doc, args.transpose.groupBy)
    const groupKey = getValueKey(groupValue)

    if (!groupKey) continue

    const columnValue = getDeepValue(doc, args.transpose.columnBy)
    const columnKey = getValueKey(columnValue)

    if (!columnKey) continue

    const columnHeader = getColumnHeader(columnValue, args.transpose.columnHeaderField, columnKey)
    const nextDynamicColumns: TransposeDynamicColumn[] =
      valueSubfields.length > 0
        ? valueSubfields.map((subfield) => ({
            header: `${columnHeader}.${subfield}`,
            key: `${columnKey}.${subfield}`,
            valueSubfield: subfield,
          }))
        : [
            {
              header: columnHeader,
              key: columnKey,
            },
          ]

    for (const column of nextDynamicColumns) {
      if (!dynamicColumnKeys.has(column.key)) {
        dynamicColumnKeys.add(column.key)
        dynamicColumns.push(column)
      }
    }

    const row = rowMap.get(groupKey) || {
      groupValue,
      values: new Map<string, string[]>(),
    }
    const value = getDeepValue(doc, args.transpose.valueField)

    for (const column of nextDynamicColumns) {
      const cellValues = row.values.get(column.key) || []
      const cellValue = column.valueSubfield
        ? serializeJoinedSubfield(value, column.valueSubfield)
        : serializeValue(value)

      if (cellValue) {
        cellValues.push(cellValue)
        row.values.set(column.key, cellValues)
      }
    }

    rowMap.set(groupKey, row)
  }

  return serializeCSV([
    [
      ...leadingColumns.map((column) => column.header),
      ...dynamicColumns.map((column) => column.header),
    ],
    ...Array.from(rowMap.values()).map((row) => [
      ...leadingColumns.map((column) => serializeTransposeLeadingColumn(row.groupValue, column)),
      ...dynamicColumns.map((column) => (row.values.get(column.key) || []).join(', ')),
    ]),
  ])
}

function getExportFieldByPath(fields: ExportField[], path: string) {
  return fields.find((field) => field.path === path)
}

function getTransposeLeadingColumns(field: ExportField, joinedFields: ExportJoinedFields) {
  const subfields = joinedFields[field.path]

  if (!subfields || subfields.length === 0) {
    return [
      {
        header: field.path,
        joinedSubfield: undefined,
      },
    ]
  }

  return subfields.map((subfield) => ({
    header: `${field.path}.${subfield}`,
    joinedSubfield: subfield,
  }))
}

function getTransposeValueSubfields(args: {
  collections: CollectionConfig[]
  joinedFields: ExportJoinedFields
  valueField: ExportField
}) {
  if (!isJoinedExportField(args.valueField)) return []

  const selectedSubfields = args.joinedFields[args.valueField.path]

  if (selectedSubfields && selectedSubfields.length > 0) return selectedSubfields

  return getRelatedExportFields(args.collections, args.valueField.relationSlug).map(
    (field) => field.path,
  )
}

function isJoinedExportField(field: ExportField) {
  return field.type === 'relationship' || field.type === 'upload' || field.type === 'join'
}

function serializeTransposeLeadingColumn(
  groupValue: unknown,
  column: {
    header: string
    joinedSubfield: string | undefined
  },
) {
  if (!column.joinedSubfield) return serializeValue(groupValue)

  return serializeJoinedSubfield(groupValue, column.joinedSubfield)
}

function getColumnHeader(value: unknown, headerField: string, fallback: string) {
  const records = getJoinedRecords(value)
  const headerValue =
    records.length > 0 ? serializeValue(getDeepValue(records[0], headerField)) : ''

  return headerValue || fallback
}

function getValueKey(value: unknown) {
  const records = getJoinedRecords(value)

  if (records.length > 0) {
    const record = records[0]

    if (isRecord(record)) {
      const id = record.id

      if (typeof id === 'string' || typeof id === 'number') return String(id)
    }

    return serializeValue(record)
  }

  return serializeValue(value)
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
    const collection = fieldRecord.collection

    return [
      {
        hasMany: Boolean(fieldRecord.hasMany),
        label: [...labelPrefix, getLabel(fieldRecord.label, name) || name].join(' / '),
        path: joinPath(pathPrefix, name),
        relationSlug:
          typeof collection === 'string'
            ? collection
            : typeof relationTo === 'string'
              ? relationTo
              : undefined,
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

function getRelatedExportFields(
  collections: CollectionConfig[],
  collectionSlug: string | undefined,
): ExportField[] {
  if (!collectionSlug) return []

  const collection = getCollectionBySlug(collections, collectionSlug)

  if (!collection) return []

  return getExportFields(collection)
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
