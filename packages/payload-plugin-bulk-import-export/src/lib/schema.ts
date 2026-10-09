import type { CollectionConfig, Field } from 'payload'

import { findHeader, normalizeColumnName } from './csv'

export type BulkUploadFieldType =
  | 'checkbox'
  | 'date'
  | 'email'
  | 'number'
  | 'relationship'
  | 'select'
  | 'text'
  | 'textarea'
  | 'upload'

export type ImportableField = {
  defaultValue?: unknown
  hasMany: boolean
  label: string
  options?: { label: string; value: string }[]
  path: string
  relationTo?: string
  required: boolean
  type: BulkUploadFieldType
}

export type SkippedRequiredField = {
  label: string
  path: string
  type: string
}

export type MatchFieldOption = {
  label: string
  path: string
  type: 'id' | BulkUploadFieldType
}

export type CollectionUploadSchema = {
  fields: ImportableField[]
  matchFieldOptions: MatchFieldOption[]
  skippedRequiredFields: SkippedRequiredField[]
}

const supportedTypes = new Set<string>([
  'checkbox',
  'date',
  'email',
  'number',
  'relationship',
  'select',
  'text',
  'textarea',
  'upload',
])

const identityFieldOrder = ['id', 'slug', 'email', 'title', 'name', 'year']

export function getCollectionUploadSchema(
  collection: CollectionConfig,
): CollectionUploadSchema {
  const fields: ImportableField[] = []
  const skippedRequiredFields: SkippedRequiredField[] = []

  collectFields({
    fields: collection.fields,
    importableFields: fields,
    labelPrefix: [],
    pathPrefix: '',
    skippedRequiredFields,
  })

  if (
    collection.slug === 'users' &&
    !fields.some((field) => field.path === 'password')
  ) {
    fields.push({
      hasMany: false,
      label: 'Password',
      path: 'password',
      required: true,
      type: 'text',
    })
  }

  return {
    fields,
    matchFieldOptions: getMatchFieldOptions(collection, fields),
    skippedRequiredFields,
  }
}

export function suggestMappings(headers: string[], fields: ImportableField[]) {
  const mapping: Record<string, string> = {}

  fields.forEach((field) => {
    const candidates = getFieldHeaderCandidates(field)
    const match = candidates
      .map((candidate) => findHeader(headers, candidate))
      .find((header): header is string => Boolean(header))

    if (match) mapping[field.path] = match
  })

  return mapping
}

export function getDefaultMatchSelection(
  headers: string[],
  matchFieldOptions: MatchFieldOption[],
) {
  const sorted = [...matchFieldOptions].sort(
    (a, b) =>
      identityFieldOrder.indexOf(a.path) - identityFieldOrder.indexOf(b.path),
  )
  const field =
    sorted.find((option) => findHeader(headers, option.path)) ??
    sorted.find((option) => option.path !== 'id') ??
    sorted[0]
  const header = field ? findHeader(headers, field.path) : undefined

  return {
    matchColumn: header ?? headers[0] ?? '',
    matchField: field?.path ?? 'id',
  }
}

export function getCollectionBySlug(
  collections: CollectionConfig[],
  slug: string,
) {
  return collections.find((collection) => collection.slug === slug)
}

export function getFieldByPath(fields: ImportableField[], path: string) {
  return fields.find((field) => field.path === path)
}

function collectFields(args: {
  fields: Field[]
  importableFields: ImportableField[]
  labelPrefix: string[]
  pathPrefix: string
  skippedRequiredFields: SkippedRequiredField[]
}) {
  args.fields.forEach((field) => {
    const fieldRecord = field as Record<string, unknown>
    const type = String(fieldRecord.type ?? '')

    if (type === 'tabs' && Array.isArray(fieldRecord.tabs)) {
      fieldRecord.tabs.forEach((tab) => {
        if (!tab || typeof tab !== 'object') return

        const tabRecord = tab as Record<string, unknown>
        const tabName = typeof tabRecord.name === 'string' ? tabRecord.name : ''
        const tabLabel = getLabel(tabRecord.label, tabName)
        const nextPathPrefix = tabName
          ? joinPath(args.pathPrefix, tabName)
          : args.pathPrefix
        const nextLabelPrefix = tabLabel
          ? [...args.labelPrefix, tabLabel]
          : args.labelPrefix
        const tabFields = Array.isArray(tabRecord.fields)
          ? (tabRecord.fields as Field[])
          : []

        collectFields({
          ...args,
          fields: tabFields,
          labelPrefix: nextLabelPrefix,
          pathPrefix: nextPathPrefix,
        })
      })
      return
    }

    if (type === 'row' || type === 'collapsible') {
      const nestedFields = Array.isArray(fieldRecord.fields)
        ? (fieldRecord.fields as Field[])
        : []

      collectFields({
        ...args,
        fields: nestedFields,
      })
      return
    }

    const name = typeof fieldRecord.name === 'string' ? fieldRecord.name : ''

    if (type === 'group') {
      const nestedFields = Array.isArray(fieldRecord.fields)
        ? (fieldRecord.fields as Field[])
        : []
      const groupLabel = getLabel(fieldRecord.label, name)

      collectFields({
        ...args,
        fields: nestedFields,
        labelPrefix: groupLabel
          ? [...args.labelPrefix, groupLabel]
          : args.labelPrefix,
        pathPrefix: name ? joinPath(args.pathPrefix, name) : args.pathPrefix,
      })
      return
    }

    if (!name) return

    const path = joinPath(args.pathPrefix, name)
    const label = [
      ...args.labelPrefix,
      getLabel(fieldRecord.label, name) || name,
    ].join(' / ')

    if (isBlockedField(fieldRecord)) return

    if (!supportedTypes.has(type)) {
      if (isRequiredWithoutDefault(fieldRecord)) {
        args.skippedRequiredFields.push({
          label,
          path,
          type,
        })
      }
      return
    }

    if (
      (type === 'relationship' || type === 'upload') &&
      typeof fieldRecord.relationTo !== 'string'
    ) {
      if (isRequiredWithoutDefault(fieldRecord)) {
        args.skippedRequiredFields.push({
          label,
          path,
          type,
        })
      }
      return
    }

    args.importableFields.push({
      defaultValue: fieldRecord.defaultValue,
      hasMany: Boolean(fieldRecord.hasMany),
      label,
      options:
        type === 'select' ? getSelectOptions(fieldRecord.options) : undefined,
      path,
      relationTo:
        type === 'relationship' || type === 'upload'
          ? String(fieldRecord.relationTo)
          : undefined,
      required: Boolean(fieldRecord.required),
      type: type as BulkUploadFieldType,
    })
  })
}

function getMatchFieldOptions(
  collection: CollectionConfig,
  fields: ImportableField[],
): MatchFieldOption[] {
  const options: MatchFieldOption[] = [{ label: 'ID', path: 'id', type: 'id' }]
  const useAsTitle = collection.admin?.useAsTitle

  fields.forEach((field) => {
    if (
      field.type === 'relationship' ||
      field.type === 'upload' ||
      field.type === 'checkbox' ||
      field.hasMany
    ) {
      return
    }

    if (
      identityFieldOrder.includes(field.path) ||
      field.path === useAsTitle ||
      field.type === 'email'
    ) {
      options.push({
        label: field.label,
        path: field.path,
        type: field.type,
      })
    }
  })

  return dedupeByPath(options).sort(
    (a, b) =>
      getIdentityOrder(a.path) - getIdentityOrder(b.path) ||
      a.label.localeCompare(b.label),
  )
}

function getFieldHeaderCandidates(field: ImportableField) {
  const finalSegment = field.path.split('.').at(-1) ?? field.path

  return [
    field.path,
    field.label,
    finalSegment,
    finalSegment.replace(/([a-z])([A-Z])/g, '$1 $2'),
  ]
}

function getIdentityOrder(path: string) {
  const index = identityFieldOrder.indexOf(path)

  return index === -1 ? identityFieldOrder.length : index
}

function dedupeByPath(options: MatchFieldOption[]) {
  const seen = new Set<string>()

  return options.filter((option) => {
    if (seen.has(option.path)) return false
    seen.add(option.path)
    return true
  })
}

function getSelectOptions(
  options: unknown,
): { label: string; value: string }[] {
  if (!Array.isArray(options)) return []

  return options
    .map((option) => {
      if (typeof option === 'string') return { label: option, value: option }
      if (!option || typeof option !== 'object') return null

      const record = option as Record<string, unknown>
      const value = typeof record.value === 'string' ? record.value : ''
      const label = typeof record.label === 'string' ? record.label : value

      return value ? { label, value } : null
    })
    .filter((option): option is { label: string; value: string } =>
      Boolean(option),
    )
}

function isBlockedField(field: Record<string, unknown>) {
  const admin =
    field.admin && typeof field.admin === 'object'
      ? (field.admin as Record<string, unknown>)
      : {}
  const access =
    field.access && typeof field.access === 'object'
      ? (field.access as Record<string, unknown>)
      : {}

  return Boolean(
    field.virtual ||
    admin.disabled ||
    admin.readOnly ||
    admin.hidden ||
    access.create === false ||
    access.update === false,
  )
}

function isRequiredWithoutDefault(field: Record<string, unknown>) {
  return Boolean(field.required && field.defaultValue === undefined)
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

export function hasHeader(headers: string[], header: string) {
  const normalizedHeader = normalizeColumnName(header)

  return headers.some(
    (candidate) => normalizeColumnName(candidate) === normalizedHeader,
  )
}
