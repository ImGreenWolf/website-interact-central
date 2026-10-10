'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useConfig } from '@payloadcms/ui'
import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import './BulkImportExportBeforeList.scss'

type ImportMode = 'create' | 'update' | 'upsert'

type ImportableField = {
  hasMany: boolean
  label: string
  options?: { label: string; value: string }[]
  path: string
  relationTo?: string
  required: boolean
  requiredOnCreate?: boolean
  type: string
}

type ExportJoinField = {
  fields: ExportJoinSubfield[]
  hasMany: boolean
  label: string
  path: string
  relationSlug?: string
  relationTo?: string
  type: 'join' | 'relationship' | 'upload'
}

type ExportJoinSubfield = {
  label: string
  path: string
  type: string
}

type ExportTransposeConfig = {
  columnBy: string
  columnHeaderField: string
  enabled: boolean
  groupBy: string
  valueField: string
}

type MatchFieldOption = {
  label: string
  path: string
  type: string
}

type BulkUploadIssue = {
  field?: string
  message: string
  row: number
}

type InspectResult = {
  defaultMatchColumn: string
  defaultMatchField: string
  fields: ImportableField[]
  headers: string[]
  matchFieldOptions: MatchFieldOption[]
  sampleRows: Record<string, string>[]
  skippedRequiredFields: { label: string; path: string; type: string }[]
  suggestedMapping: Record<string, string>
}

type PreviewResult = {
  errors: BulkUploadIssue[]
  rows: {
    errors: BulkUploadIssue[]
    matchValue: string
    operation: 'create' | 'skip' | 'update'
    row: number
    skippedReason?: string
  }[]
  summary: {
    create: number
    errors: number
    skip: number
    update: number
  }
}

type ImportResult = {
  created?: { id: string; row: number }[]
  errors?: BulkUploadIssue[]
  message?: string
  skipped?: { reason: string; row: number }[]
  updated?: { id: string; row: number }[]
}

type RequestState = {
  message: string
  tone: 'error' | 'success'
}

const modes: { label: string; value: ImportMode }[] = [
  {
    label: 'Upsert',
    value: 'upsert',
  },
  {
    label: 'Create only',
    value: 'create',
  },
  {
    label: 'Update existing',
    value: 'update',
  },
]

const importBatchSize = 1

export default function BulkImportExportBeforeListClient(props: { endpointBase?: string }) {
  const { config } = useConfig()
  const {
    routes: { api },
  } = config
  const pathname = usePathname()
  const router = useRouter()
  const collection = useMemo(() => getCollectionSlug(pathname), [pathname])
  const endpointBase = normalizeEndpointBase(props.endpointBase)
  const exportJoinFields = useMemo(
    () => getExportJoinFields(config.collections, collection),
    [collection, config.collections],
  )
  const exportFieldOptions = useMemo(
    () => getExportFieldOptions(config.collections, collection),
    [collection, config.collections],
  )
  const defaultTransposeExport = useMemo(
    () => getDefaultTransposeConfig(collection, exportJoinFields),
    [collection, exportJoinFields],
  )
  const [file, setFile] = useState<File | null>(null)
  const [inspectResult, setInspectResult] = useState<InspectResult | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [matchField, setMatchField] = useState('id')
  const [matchColumn, setMatchColumn] = useState('')
  const [mode, setMode] = useState<ImportMode>('upsert')
  const [selectedExportJoinFields, setSelectedExportJoinFields] = useState<
    Record<string, string[]>
  >({})
  const [transposeExport, setTransposeExport] =
    useState<ExportTransposeConfig>(defaultTransposeExport)
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [requestState, setRequestState] = useState<RequestState | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const transposeColumnHeaderFields = useMemo(() => {
    return exportJoinFields.find((field) => field.path === transposeExport.columnBy)?.fields || []
  }, [exportJoinFields, transposeExport.columnBy])
  const transposeValueJoinField = useMemo(() => {
    return exportJoinFields.find((field) => field.path === transposeExport.valueField)
  }, [exportJoinFields, transposeExport.valueField])

  useEffect(() => {
    setTransposeExport(defaultTransposeExport)
  }, [defaultTransposeExport])

  useEffect(() => {
    if (!collection) return

    const findActions = () => {
      setPortalTarget(document.querySelector<HTMLElement>('.list-controls .search-bar__actions'))
    }

    findActions()

    const observer = new MutationObserver(findActions)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [collection])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsImportOpen(false)
        setIsExportOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!collection) return null

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null

    setFile(nextFile)
    setInspectResult(null)
    setMode('upsert')
    setPreviewResult(null)
    setImportResult(null)
    setRequestState(null)
  }

  async function handleInspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!file) {
      setRequestState({
        message: 'Select a CSV file before inspecting.',
        tone: 'error',
      })
      return
    }

    setIsWorking(true)
    setRequestState(null)
    setPreviewResult(null)
    setImportResult(null)

    try {
      const result = await sendBulkUploadRequest<InspectResult>('inspect', {
        api,
        collection,
        endpointBase,
        file,
      })

      setInspectResult(result)
      setMapping(result.suggestedMapping || {})
      setMatchField(result.defaultMatchField || 'id')
      setMatchColumn(result.defaultMatchColumn || result.headers[0] || '')
      setRequestState({
        message: `Found ${result.headers.length} columns and ${result.fields.length} importable fields.`,
        tone: 'success',
      })
    } catch (error) {
      setRequestState({
        message: getErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsWorking(false)
    }
  }

  async function handlePreview() {
    if (!file || !inspectResult) return

    setIsWorking(true)
    setRequestState(null)
    setPreviewResult(null)
    setImportResult(null)

    try {
      const result = await sendBulkUploadRequest<PreviewResult>('preview', {
        api,
        collection,
        endpointBase,
        file,
        mapping,
        matchColumn,
        matchField,
        mode,
      })

      setPreviewResult(result)
      const importableRows = getImportablePreviewRows(result)
      const skippedOnly =
        importableRows.length === 0 && result.summary.skip > 0 && result.summary.errors === 0

      setRequestState({
        message: skippedOnly
          ? getSkippedOnlyMessage(mode)
          : `${result.summary.create} create, ${result.summary.update} update, ${result.summary.skip} skip, ${result.summary.errors} error rows.`,
        tone: result.summary.errors > 0 || skippedOnly ? 'error' : 'success',
      })
    } catch (error) {
      setRequestState({
        message: getErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsWorking(false)
    }
  }

  async function handleImport() {
    if (!file || !inspectResult || !previewResult) return

    setIsWorking(true)
    setRequestState(null)
    setImportResult(null)

    try {
      const importableRows = getImportablePreviewRows(previewResult)
      const aggregate: Required<ImportResult> = {
        created: [],
        errors: [],
        message: '',
        skipped: [],
        updated: [],
      }

      for (let index = 0; index < importableRows.length; index += importBatchSize) {
        const batch = importableRows.slice(index, index + importBatchSize)
        setRequestState({
          message: `Importing ${Math.min(index + importBatchSize, importableRows.length)} of ${importableRows.length} rows...`,
          tone: 'success',
        })

        const result = await sendBulkUploadRequest<ImportResult>('import', {
          api,
          collection,
          endpointBase,
          file,
          mapping,
          matchColumn,
          matchField,
          mode,
          rowNumbers: batch.map((row) => row.row),
        })

        aggregate.created.push(...(result.created || []))
        aggregate.updated.push(...(result.updated || []))
        aggregate.skipped.push(...(result.skipped || []))
        aggregate.errors.push(...(result.errors || []))
      }

      aggregate.message = [
        `${aggregate.created.length} created`,
        `${aggregate.updated.length} updated`,
        `${aggregate.skipped.length} skipped`,
        `${aggregate.errors.length} errors`,
      ].join(', ')

      setImportResult(aggregate)
      setRequestState({
        message: aggregate.message,
        tone: aggregate.errors.length > 0 ? 'error' : 'success',
      })
      router.refresh()
    } catch (error) {
      setRequestState({
        message: getErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsWorking(false)
    }
  }

  async function handleExport() {
    setIsWorking(true)
    setRequestState(null)

    try {
      await sendBulkExportRequest({
        api,
        collection,
        endpointBase,
        joinedFields: selectedExportJoinFields,
        queryString: typeof window === 'undefined' ? '' : window.location.search,
        transpose: transposeExport,
      })
      setRequestState({
        message: 'CSV export started.',
        tone: 'success',
      })
    } catch (error) {
      setRequestState({
        message: getErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsWorking(false)
    }
  }

  const validPreviewRows = previewResult ? getImportablePreviewRows(previewResult).length : 0

  const trigger = (
    <div className="bulk-upload-triggers">
      <button
        aria-haspopup="dialog"
        className="bulk-upload-trigger pill pill--style-light pill--size-small pill--has-action"
        id={`bulk-upload-trigger-${collection}`}
        onClick={() => setIsImportOpen(true)}
        type="button"
      >
        <span className="pill__label">Import CSV</span>
      </button>
      <button
        aria-haspopup="dialog"
        className="bulk-upload-trigger pill pill--style-light pill--size-small pill--has-action"
        id={`bulk-export-trigger-${collection}`}
        onClick={() => setIsExportOpen(true)}
        type="button"
      >
        <span className="pill__label">Export CSV</span>
      </button>
    </div>
  )

  return (
    <>
      {portalTarget ? createPortal(trigger, portalTarget) : trigger}

      {isImportOpen && (
        <div className="bulk-upload-modal" role="presentation">
          <button
            aria-label="Close bulk upload"
            className="bulk-upload-modal__backdrop"
            onClick={() => setIsImportOpen(false)}
            type="button"
          />

          <section
            aria-labelledby={`bulk-upload-title-${collection}`}
            aria-modal="true"
            className="bulk-upload"
            role="dialog"
          >
            <form className="bulk-upload__intro" onSubmit={handleInspect}>
              <div className="bulk-upload__header">
                <div>
                  <h2 className="bulk-upload__title" id={`bulk-upload-title-${collection}`}>
                    Import/export
                  </h2>
                  <p className="bulk-upload__description">
                    Upload a CSV, map columns, preview row changes, then import into this
                    collection, or export the current list view.
                  </p>
                </div>

                <button
                  aria-label="Close bulk upload"
                  className="bulk-upload__close"
                  onClick={() => setIsImportOpen(false)}
                  type="button"
                >
                  x
                </button>
              </div>

              <div className="bulk-upload__upload-row">
                <label className="bulk-upload__field" htmlFor={`bulk-upload-${collection}`}>
                  <span>CSV file</span>
                  <input
                    accept=".csv,text/csv"
                    disabled={isWorking}
                    id={`bulk-upload-${collection}`}
                    onChange={handleFileChange}
                    type="file"
                  />
                </label>

                <button className="bulk-upload__button" disabled={isWorking} type="submit">
                  {isWorking && !inspectResult ? 'Inspecting...' : 'Inspect CSV'}
                </button>
              </div>
            </form>

            {inspectResult && (
              <div className="bulk-upload__wizard">
                <div className="bulk-upload__controls">
                  <label className="bulk-upload__field">
                    <span>Import mode</span>
                    <select
                      disabled={isWorking}
                      onChange={(event) => {
                        setMode(event.target.value as ImportMode)
                        setPreviewResult(null)
                      }}
                      value={mode}
                    >
                      {modes.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="bulk-upload__field">
                    <span>Match field</span>
                    <select
                      disabled={isWorking}
                      onChange={(event) => {
                        setMatchField(event.target.value)
                        setPreviewResult(null)
                      }}
                      value={matchField}
                    >
                      {inspectResult.matchFieldOptions.map((option) => (
                        <option key={option.path} value={option.path}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="bulk-upload__field">
                    <span>Match column</span>
                    <select
                      disabled={isWorking}
                      onChange={(event) => {
                        setMatchColumn(event.target.value)
                        setPreviewResult(null)
                      }}
                      value={matchColumn}
                    >
                      {inspectResult.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="bulk-upload__mapping">
                  <div className="bulk-upload__mapping-header">
                    <span>Collection field</span>
                    <span>CSV column</span>
                  </div>

                  {inspectResult.fields.map((field) => (
                    <div className="bulk-upload__mapping-row" key={field.path}>
                      <div>
                        <strong>{field.label}</strong>
                        <span>
                          {field.path} · {field.type}
                          {field.hasMany ? '[]' : ''}
                          {field.required ? ' · required' : ''}
                          {field.requiredOnCreate ? ' · required on create' : ''}
                        </span>
                      </div>

                      <select
                        disabled={isWorking}
                        onChange={(event) => {
                          setMapping((current) => ({
                            ...current,
                            [field.path]: event.target.value,
                          }))
                          setPreviewResult(null)
                        }}
                        value={mapping[field.path] || ''}
                      >
                        <option value="">Do not import</option>
                        {inspectResult.headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {inspectResult.skippedRequiredFields.length > 0 && (
                  <div className="bulk-upload__note">
                    Required fields skipped by v1:{' '}
                    {inspectResult.skippedRequiredFields
                      .map((field) => `${field.label} (${field.type})`)
                      .join(', ')}
                  </div>
                )}

                {inspectResult.sampleRows.length > 0 && (
                  <details className="bulk-upload__sample">
                    <summary>Preview CSV sample</summary>
                    <div className="bulk-upload__table-wrap">
                      <table>
                        <thead>
                          <tr>
                            {inspectResult.headers.map((header) => (
                              <th key={header}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {inspectResult.sampleRows.map((row, index) => (
                            <tr key={index}>
                              {inspectResult.headers.map((header) => (
                                <td key={header}>{row[header]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}

                <div className="bulk-upload__actions">
                  <button
                    className="bulk-upload__button bulk-upload__button--secondary"
                    disabled={isWorking}
                    onClick={handlePreview}
                    type="button"
                  >
                    {isWorking && !importResult ? 'Previewing...' : 'Preview rows'}
                  </button>

                  <button
                    className="bulk-upload__button"
                    disabled={isWorking || !previewResult || validPreviewRows === 0}
                    onClick={handleImport}
                    type="button"
                  >
                    {isWorking && Boolean(previewResult) ? 'Importing...' : 'Import valid rows'}
                  </button>
                </div>
              </div>
            )}

            {requestState && (
              <div className={`bulk-upload__result bulk-upload__result--${requestState.tone}`}>
                {requestState.message}
              </div>
            )}

            {previewResult && (
              <ResultDetails
                issues={previewResult.rows.flatMap((row) => row.errors)}
                skipped={previewResult.rows
                  .filter((row) => row.operation === 'skip' && row.skippedReason)
                  .map((row) => ({
                    reason: row.skippedReason || 'Skipped.',
                    row: row.row,
                  }))}
              />
            )}

            {importResult && (
              <ResultDetails
                issues={importResult.errors || []}
                skipped={importResult.skipped || []}
              />
            )}
          </section>
        </div>
      )}

      {isExportOpen && (
        <div className="bulk-upload-modal" role="presentation">
          <button
            aria-label="Close bulk export"
            className="bulk-upload-modal__backdrop"
            onClick={() => setIsExportOpen(false)}
            type="button"
          />

          <section
            aria-labelledby={`bulk-export-title-${collection}`}
            aria-modal="true"
            className="bulk-upload bulk-upload--export"
            role="dialog"
          >
            <div className="bulk-upload__header">
              <div>
                <h2 className="bulk-upload__title" id={`bulk-export-title-${collection}`}>
                  Export CSV
                </h2>
                <p className="bulk-upload__description">
                  Export the current list view. Toggle joined fields to include populated
                  relationship, upload, or join data in the CSV instead of plain IDs.
                </p>
              </div>

              <button
                aria-label="Close bulk export"
                className="bulk-upload__close"
                onClick={() => setIsExportOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="bulk-upload__export-options">
              <div className="bulk-upload__export-options-header">
                <strong>Transpose export</strong>
                <label className="bulk-upload__switch">
                  <input
                    checked={transposeExport.enabled}
                    disabled={isWorking}
                    onChange={(event) => {
                      setTransposeExport((current) => ({
                        ...current,
                        enabled: event.target.checked,
                      }))
                    }}
                    type="checkbox"
                  />
                  <span>{transposeExport.enabled ? 'Enabled' : 'Disabled'}</span>
                </label>
              </div>

              <p className="bulk-upload__helper">
                Condense repeated records into one row per selected field, then create dynamic
                columns from another field. For attendance exports, group by user and create columns
                from meetings.
              </p>

              <div className="bulk-upload__transpose-grid">
                <label className="bulk-upload__field">
                  <span>Group rows by</span>
                  <select
                    disabled={isWorking || !transposeExport.enabled}
                    onChange={(event) => {
                      setTransposeExport((current) => ({
                        ...current,
                        groupBy: event.target.value,
                      }))
                    }}
                    value={transposeExport.groupBy}
                  >
                    {exportJoinFields.map((field) => (
                      <option key={field.path} value={field.path}>
                        {field.label} ({field.path})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bulk-upload__field">
                  <span>Create columns from</span>
                  <select
                    disabled={isWorking || !transposeExport.enabled}
                    onChange={(event) => {
                      const nextColumnBy = event.target.value
                      const nextHeaderFields =
                        exportJoinFields.find((field) => field.path === nextColumnBy)?.fields || []

                      setTransposeExport((current) => ({
                        ...current,
                        columnBy: nextColumnBy,
                        columnHeaderField:
                          nextHeaderFields.find((field) => field.path === current.columnHeaderField)
                            ?.path ||
                          nextHeaderFields.find((field) => field.path === 'id')?.path ||
                          nextHeaderFields[0]?.path ||
                          'id',
                      }))
                    }}
                    value={transposeExport.columnBy}
                  >
                    {exportJoinFields.map((field) => (
                      <option key={field.path} value={field.path}>
                        {field.label} ({field.path})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bulk-upload__field">
                  <span>Cell value</span>
                  <select
                    disabled={isWorking || !transposeExport.enabled}
                    onChange={(event) => {
                      const nextValueField = event.target.value
                      const nextJoinField = exportJoinFields.find(
                        (field) => field.path === nextValueField,
                      )

                      setTransposeExport((current) => ({
                        ...current,
                        valueField: nextValueField,
                      }))

                      if (nextJoinField) {
                        setSelectedExportJoinFields((current) => ({
                          ...current,
                          [nextJoinField.path]:
                            current[nextJoinField.path] || getDefaultJoinedSubfields(nextJoinField),
                        }))
                      }
                    }}
                    value={transposeExport.valueField}
                  >
                    {exportFieldOptions.map((field) => (
                      <option key={field.path} value={field.path}>
                        {field.label} ({field.path})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bulk-upload__field">
                  <span>Column header</span>
                  <select
                    disabled={isWorking || !transposeExport.enabled}
                    onChange={(event) => {
                      setTransposeExport((current) => ({
                        ...current,
                        columnHeaderField: event.target.value,
                      }))
                    }}
                    value={transposeExport.columnHeaderField}
                  >
                    {transposeColumnHeaderFields.map((field) => (
                      <option key={field.path} value={field.path}>
                        {field.label} ({field.path})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {transposeExport.enabled && selectedExportJoinFields[transposeExport.groupBy] && (
                <div className="bulk-upload__note">
                  The selected subfields for {transposeExport.groupBy} will become the leading CSV
                  columns before the transposed meeting columns.
                </div>
              )}

              {transposeExport.enabled && transposeValueJoinField && (
                <div className="bulk-upload__note">
                  The selected subfields for {transposeExport.valueField} will expand each dynamic
                  column as {transposeExport.columnHeaderField || 'header'}.fieldName.
                </div>
              )}
            </div>

            <div className="bulk-upload__export-options">
              <div className="bulk-upload__export-options-header">
                <strong>Joined fields</strong>
                {exportJoinFields.length > 0 && (
                  <button
                    className="bulk-upload__button bulk-upload__button--secondary bulk-upload__button--compact"
                    disabled={isWorking}
                    onClick={() => {
                      setSelectedExportJoinFields((current) => {
                        const allSelected = Object.keys(current).length === exportJoinFields.length

                        if (allSelected) return {}

                        return Object.fromEntries(
                          exportJoinFields.map((field) => [
                            field.path,
                            getDefaultJoinedSubfields(field),
                          ]),
                        )
                      })
                    }}
                    type="button"
                  >
                    {Object.keys(selectedExportJoinFields).length === exportJoinFields.length
                      ? 'Clear all'
                      : 'Select all'}
                  </button>
                )}
              </div>

              {exportJoinFields.length > 0 ? (
                exportJoinFields.map((field) => (
                  <div className="bulk-upload__join-option" key={field.path}>
                    <label className="bulk-upload__join-toggle">
                      <input
                        checked={Boolean(selectedExportJoinFields[field.path])}
                        disabled={isWorking}
                        onChange={(event) => {
                          setSelectedExportJoinFields((current) => {
                            if (!event.target.checked) {
                              const { [field.path]: _removed, ...next } = current

                              return next
                            }

                            return {
                              ...current,
                              [field.path]: current[field.path] || getDefaultJoinedSubfields(field),
                            }
                          })
                        }}
                        type="checkbox"
                      />
                      <span>
                        <strong>{field.label}</strong>
                        <small>
                          {field.path} · {field.type}
                          {field.hasMany ? '[]' : ''}
                          {field.relationTo ? ` · ${field.relationTo}` : ''}
                        </small>
                      </span>
                    </label>

                    {selectedExportJoinFields[field.path] && (
                      <div className="bulk-upload__join-subfields">
                        {field.fields.length > 0 ? (
                          field.fields.map((subfield) => (
                            <label className="bulk-upload__subfield-toggle" key={subfield.path}>
                              <input
                                checked={selectedExportJoinFields[field.path]?.includes(
                                  subfield.path,
                                )}
                                disabled={isWorking}
                                onChange={(event) => {
                                  setSelectedExportJoinFields((current) => {
                                    const currentSubfields = current[field.path] || []

                                    return {
                                      ...current,
                                      [field.path]: event.target.checked
                                        ? [...new Set([...currentSubfields, subfield.path])]
                                        : currentSubfields.filter((path) => path !== subfield.path),
                                    }
                                  })
                                }}
                                type="checkbox"
                              />
                              <span>
                                {subfield.label}
                                <small>
                                  {subfield.path} · {subfield.type}
                                </small>
                              </span>
                            </label>
                          ))
                        ) : (
                          <small>No fields are available for this related collection.</small>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="bulk-upload__note">
                  This collection has no relationship, upload, or join fields to toggle.
                </div>
              )}
            </div>

            <div className="bulk-upload__actions">
              <button
                className="bulk-upload__button bulk-upload__button--secondary"
                disabled={isWorking}
                onClick={() => setIsExportOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="bulk-upload__button"
                disabled={isWorking}
                onClick={handleExport}
                type="button"
              >
                {isWorking ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>

            {requestState && (
              <div className={`bulk-upload__result bulk-upload__result--${requestState.tone}`}>
                {requestState.message}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}

function ResultDetails(props: {
  issues: BulkUploadIssue[]
  skipped: { reason: string; row: number }[]
}) {
  if (props.issues.length === 0 && props.skipped.length === 0) return null

  return (
    <ul className="bulk-upload__issues">
      {props.skipped.map((issue) => (
        <li key={`skip-${issue.row}-${issue.reason}`}>
          Row {issue.row}: {issue.reason}
        </li>
      ))}
      {props.issues.map((issue) => (
        <li key={`issue-${issue.row}-${issue.field}-${issue.message}`}>
          Row {issue.row}: {issue.field ? `${issue.field} - ` : ''}
          {issue.message}
        </li>
      ))}
    </ul>
  )
}

async function sendBulkUploadRequest<TResponse>(
  action: 'import' | 'inspect' | 'preview',
  args: {
    api: string
    collection: string
    endpointBase: string
    file: File
    mapping?: Record<string, string>
    matchColumn?: string
    matchField?: string
    mode?: ImportMode
    rowNumbers?: number[]
  },
): Promise<TResponse> {
  const response = await fetch(`${args.api}${args.endpointBase}/${action}`, {
    body: JSON.stringify({
      collection: args.collection,
      csvBase64: await fileToBase64(args.file),
      fileName: args.file.name,
      mapping: args.mapping,
      matchColumn: args.matchColumn,
      matchField: args.matchField,
      mode: args.mode,
      rowNumbers: args.rowNumbers,
    }),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  const data = await readBulkUploadResponse(response)

  if (!response.ok) {
    throw new Error(data?.message || 'Bulk upload request failed.')
  }

  return data as TResponse
}

async function sendBulkExportRequest(args: {
  api: string
  collection: string
  endpointBase: string
  joinedFields: Record<string, string[]>
  queryString: string
  transpose: ExportTransposeConfig
}) {
  const response = await fetch(`${args.api}${args.endpointBase}/export`, {
    body: JSON.stringify({
      collection: args.collection,
      joinedFields: args.joinedFields,
      queryString: args.queryString,
      transpose: args.transpose,
    }),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    const data = await readBulkUploadResponse(response)
    throw new Error(data?.message || 'Bulk export request failed.')
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${args.collection}.csv`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function getImportablePreviewRows(result: PreviewResult) {
  return result.rows.filter((row) => row.errors.length === 0 && row.operation !== 'skip')
}

function getSkippedOnlyMessage(mode: ImportMode) {
  if (mode === 'update') {
    return 'No rows will be imported because update mode only changes existing documents. Use Upsert to create missing rows.'
  }

  if (mode === 'create') {
    return 'No rows will be imported because create mode skips rows that already exist. Use Upsert to update matching rows.'
  }

  return 'No rows are ready to import. Check the match field and match column.'
}

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

async function readBulkUploadResponse(response: Response): Promise<{
  message?: string
  [key: string]: unknown
}> {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.toLowerCase().includes('application/json')) {
    return (await response.json()) as { message?: string; [key: string]: unknown }
  }

  const text = await response.text()
  const title = text.match(/<title>(.*?)<\/title>/i)?.[1]?.trim()
  const message =
    title ||
    text
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  return {
    message:
      message ||
      `Bulk upload returned a non-JSON response${response.status ? ` (${response.status})` : ''}.`,
  }
}

function getCollectionSlug(pathname: string | null) {
  if (!pathname) return ''

  const segments = pathname.split('/').filter(Boolean)
  const collectionsIndex = segments.indexOf('collections')

  if (collectionsIndex === -1) return ''

  return decodeURIComponent(segments[collectionsIndex + 1] || '')
}

function getExportJoinFields(collections: unknown, collectionSlug: string): ExportJoinField[] {
  if (!Array.isArray(collections) || !collectionSlug) return []

  const collection = collections.find((item) => {
    if (!item || typeof item !== 'object') return false

    return (item as Record<string, unknown>).slug === collectionSlug
  }) as { fields?: unknown[] } | undefined

  return collection?.fields ? collectExportJoinFields(collection.fields, collections) : []
}

function getExportFieldOptions(collections: unknown, collectionSlug: string): ExportJoinSubfield[] {
  if (!Array.isArray(collections) || !collectionSlug) return []

  const collection = collections.find((item) => {
    if (!item || typeof item !== 'object') return false

    return (item as Record<string, unknown>).slug === collectionSlug
  }) as { fields?: unknown[]; timestamps?: boolean } | undefined

  if (!collection) return []

  return [
    { label: 'ID', path: 'id', type: 'id' },
    ...collectExportSubfields(collection.fields || []),
    ...(collection.timestamps === false
      ? []
      : [
          { label: 'Created At', path: 'createdAt', type: 'date' },
          { label: 'Updated At', path: 'updatedAt', type: 'date' },
        ]),
  ]
}

function getDefaultTransposeConfig(
  collection: string,
  joinFields: ExportJoinField[],
): ExportTransposeConfig {
  const userField = joinFields.find((field) => field.path === 'user')
  const meetingField = joinFields.find((field) => field.path === 'meeting')
  const groupBy = collection === 'attendances' ? userField?.path : joinFields[0]?.path
  const columnBy =
    collection === 'attendances'
      ? meetingField?.path || joinFields.find((field) => field.path !== groupBy)?.path
      : joinFields.find((field) => field.path !== groupBy)?.path || joinFields[1]?.path
  const columnHeaderFields = joinFields.find((field) => field.path === columnBy)?.fields || []

  return {
    columnBy: columnBy || '',
    columnHeaderField:
      columnHeaderFields.find((field) => field.path === 'id')?.path ||
      columnHeaderFields[0]?.path ||
      'id',
    enabled: false,
    groupBy: groupBy || '',
    valueField: 'createdAt',
  }
}

function collectExportJoinFields(
  fields: unknown[],
  collections: unknown[],
  pathPrefix = '',
  labelPrefix: string[] = [],
): ExportJoinField[] {
  return fields.flatMap((field) => {
    if (!field || typeof field !== 'object') return []

    const fieldRecord = field as Record<string, unknown>
    const type = String(fieldRecord.type ?? '')

    if (type === 'tabs' && Array.isArray(fieldRecord.tabs)) {
      return fieldRecord.tabs.flatMap((tab) => {
        if (!tab || typeof tab !== 'object') return []

        const tabRecord = tab as Record<string, unknown>
        const tabName = typeof tabRecord.name === 'string' ? tabRecord.name : ''
        const tabLabel = getFieldLabel(tabRecord.label, tabName)
        const tabFields = Array.isArray(tabRecord.fields) ? tabRecord.fields : []

        return collectExportJoinFields(
          tabFields,
          collections,
          tabName ? joinPath(pathPrefix, tabName) : pathPrefix,
          tabLabel ? [...labelPrefix, tabLabel] : labelPrefix,
        )
      })
    }

    if (type === 'row' || type === 'collapsible') {
      return Array.isArray(fieldRecord.fields)
        ? collectExportJoinFields(fieldRecord.fields, collections, pathPrefix, labelPrefix)
        : []
    }

    const name = typeof fieldRecord.name === 'string' ? fieldRecord.name : ''

    if (type === 'group') {
      const groupLabel = getFieldLabel(fieldRecord.label, name)

      return Array.isArray(fieldRecord.fields)
        ? collectExportJoinFields(
            fieldRecord.fields,
            collections,
            name ? joinPath(pathPrefix, name) : pathPrefix,
            groupLabel ? [...labelPrefix, groupLabel] : labelPrefix,
          )
        : []
    }

    if (!name || (type !== 'relationship' && type !== 'upload' && type !== 'join')) return []

    const relationSlug = getJoinedCollectionSlug(fieldRecord)
    const relationTo = fieldRecord.relationTo

    return [
      {
        fields: getRelatedExportFields(collections, relationSlug),
        hasMany: Boolean(fieldRecord.hasMany),
        label: [...labelPrefix, getFieldLabel(fieldRecord.label, name) || name].join(' / '),
        path: joinPath(pathPrefix, name),
        relationSlug,
        relationTo:
          typeof relationTo === 'string'
            ? relationTo
            : Array.isArray(relationTo)
              ? relationTo.join(', ')
              : undefined,
        type: type as ExportJoinField['type'],
      },
    ]
  })
}

function getRelatedExportFields(collections: unknown[], collectionSlug: string | undefined) {
  if (!collectionSlug) return []

  const collection = collections.find((item) => {
    if (!item || typeof item !== 'object') return false

    return (item as Record<string, unknown>).slug === collectionSlug
  }) as { fields?: unknown[]; timestamps?: boolean } | undefined

  if (!collection) return []

  return [
    { label: 'ID', path: 'id', type: 'id' },
    ...collectExportSubfields(collection.fields || []),
    ...(collection.timestamps === false
      ? []
      : [
          { label: 'Created At', path: 'createdAt', type: 'date' },
          { label: 'Updated At', path: 'updatedAt', type: 'date' },
        ]),
  ]
}

function collectExportSubfields(
  fields: unknown[],
  pathPrefix = '',
  labelPrefix: string[] = [],
): ExportJoinSubfield[] {
  return fields.flatMap((field) => {
    if (!field || typeof field !== 'object') return []

    const fieldRecord = field as Record<string, unknown>
    const type = String(fieldRecord.type ?? '')

    if (type === 'tabs' && Array.isArray(fieldRecord.tabs)) {
      return fieldRecord.tabs.flatMap((tab) => {
        if (!tab || typeof tab !== 'object') return []

        const tabRecord = tab as Record<string, unknown>
        const tabName = typeof tabRecord.name === 'string' ? tabRecord.name : ''
        const tabLabel = getFieldLabel(tabRecord.label, tabName)
        const tabFields = Array.isArray(tabRecord.fields) ? tabRecord.fields : []

        return collectExportSubfields(
          tabFields,
          tabName ? joinPath(pathPrefix, tabName) : pathPrefix,
          tabLabel ? [...labelPrefix, tabLabel] : labelPrefix,
        )
      })
    }

    if (type === 'row' || type === 'collapsible') {
      return Array.isArray(fieldRecord.fields)
        ? collectExportSubfields(fieldRecord.fields, pathPrefix, labelPrefix)
        : []
    }

    const name = typeof fieldRecord.name === 'string' ? fieldRecord.name : ''

    if (type === 'group') {
      const groupLabel = getFieldLabel(fieldRecord.label, name)

      return Array.isArray(fieldRecord.fields)
        ? collectExportSubfields(
            fieldRecord.fields,
            name ? joinPath(pathPrefix, name) : pathPrefix,
            groupLabel ? [...labelPrefix, groupLabel] : labelPrefix,
          )
        : []
    }

    if (!name || type === 'join' || fieldRecord.virtual) return []

    return [
      {
        label: [...labelPrefix, getFieldLabel(fieldRecord.label, name) || name].join(' / '),
        path: joinPath(pathPrefix, name),
        type,
      },
    ]
  })
}

function getDefaultJoinedSubfields(field: ExportJoinField) {
  return field.fields.length > 0 ? field.fields.map((subfield) => subfield.path) : []
}

function getJoinedCollectionSlug(field: Record<string, unknown>) {
  const collection = field.collection
  const relationTo = field.relationTo

  if (typeof collection === 'string') return collection
  if (typeof relationTo === 'string') return relationTo

  return undefined
}

function getFieldLabel(label: unknown, fallback: string) {
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Bulk import/export request failed.'
}

function normalizeEndpointBase(value: string | undefined) {
  const endpointBase = value || '/bulk-import-export'

  return endpointBase.endsWith('/') ? endpointBase.slice(0, -1) : endpointBase
}
