import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { board, boardAdminAccess, boardAdminHidden } from '../access/roles'
import { slugField } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    admin: boardAdminAccess,
    create: board,
    delete: board,
    read: anyone,
    update: board,
  },
  admin: {
    hidden: boardAdminHidden,
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slugField({
      position: undefined,
    }),
  ],
}
