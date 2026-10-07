import type { CollectionConfig } from 'payload'

import {
  board,
  boardFieldAccess,
  boardOrSelf,
  isBoardMember,
  memberAdminAccess,
} from '../../access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: memberAdminAccess,
    create: board,
    delete: board,
    read: boardOrSelf,
    update: board,
  },
  admin: {
    defaultColumns: ['name', 'email'],
    hidden: ({ user }) => !isBoardMember(user),
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'attendance',
      type: 'join',
      collection: 'attendances',
      on: 'user',
      hasMany: true,
    },
    {
      name: 'role',
      type: 'select',
      saveToJWT: true,
      defaultValue: 'board',
      options: [
        'active',
        'board',
      ],
      access: {
        create: boardFieldAccess,
        update: boardFieldAccess,
      },
    },
  ],
  timestamps: true,
}
