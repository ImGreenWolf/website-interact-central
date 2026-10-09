import type { Payload, PayloadRequest } from 'payload'

export type BulkUploadResolver = (args: {
  createUploads: boolean
  payload: Payload
  relationTo: string
  req: PayloadRequest
  value: string
}) => Promise<null | string | undefined>

export type BulkImportExportPluginConfig = {
  collections: string[]
  enabled?: boolean
  endpointBase?: `/${string}`
  uploadResolver?: BulkUploadResolver
}

export type NormalizedBulkImportExportPluginConfig = {
  collections: string[]
  endpointBase: `/${string}`
  uploadResolver?: BulkUploadResolver
}
