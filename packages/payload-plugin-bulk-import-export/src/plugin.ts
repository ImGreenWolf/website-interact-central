import type { CollectionConfig, Config, Plugin } from 'payload'

import { createBulkImportExportEndpoints } from './lib/endpoints'
import type {
  BulkImportExportPluginConfig,
  NormalizedBulkImportExportPluginConfig,
} from './types'

const defaultEndpointBase = '/bulk-import-export'
const beforeListComponent = {
  exportName: 'BulkImportExportBeforeList',
  path: '@interact2241/payload-plugin-bulk-import-export/rsc',
}

export const bulkImportExportPlugin = (
  options: BulkImportExportPluginConfig,
): Plugin => {
  const plugin: Plugin = (config: Config): Config => {
    if (options.enabled === false) return config

    const normalized = normalizeOptions(options)

    return {
      ...config,
      collections: (config.collections || []).map((collection) =>
        appendBulkImportExportComponent(collection, normalized),
      ),
      endpoints: [
        ...(config.endpoints || []),
        ...createBulkImportExportEndpoints(config.collections || [], normalized),
      ],
    }
  }

  plugin.slug = 'bulk-import-export'
  plugin.options = options as unknown as Record<string, unknown>

  return plugin
}

function normalizeOptions(
  options: BulkImportExportPluginConfig,
): NormalizedBulkImportExportPluginConfig {
  return {
    collections: [...new Set(options.collections)],
    endpointBase: options.endpointBase || defaultEndpointBase,
    uploadResolver: options.uploadResolver,
  }
}

function appendBulkImportExportComponent(
  collection: CollectionConfig,
  options: NormalizedBulkImportExportPluginConfig,
): CollectionConfig {
  if (!options.collections.includes(collection.slug)) return collection

  return {
    ...collection,
    admin: {
      ...collection.admin,
      components: {
        ...collection.admin?.components,
        beforeList: [
          ...(collection.admin?.components?.beforeList || []),
          {
            ...beforeListComponent,
            serverProps: {
              endpointBase: options.endpointBase,
            },
          },
        ],
      },
    },
  }
}
