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
      defaultValue: 'Președinte',
      options: [
        'Membru Activ',
        'Membru Pasiv',
        'Președinte',
        'Vicepreședinte',
        'Secretar',
        'Trezorier',
        'PM Director',
        'PR Director',
        'IR Director',
        'HR Director',
        'Past-President',

      ],
      access: {
        create: boardFieldAccess,
        update: boardFieldAccess,
      },
    },
    {
      name: 'joinedAt',
      type: 'date',
      required: true,
      defaultValue: new Date()
    }
  ],
  timestamps: true,
}
