import type { CollectionConfig } from 'payload'

import { board, boardOrOwnAttendance, memberAdminAccess } from '../access/roles'

export const Attendances: CollectionConfig = {
  slug: 'attendances',
  access: {
    admin: memberAdminAccess,
    create: board,
    delete: board,
    read: boardOrOwnAttendance,
    update: board,
  },
  indexes: [{fields: ['user', 'meeting'], unique: true}],
  admin: {
    useAsTitle: 'user',
    components: {
      views: {
        list: {
          actions: ['@/components/Attendance/DisplayRouteButton#AttendanceDisplayRouteButton'],
        },
        scanner: {
          Component: '@/components/Attendance/DisplayView',
          path: '/display',
        },
      },
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'meeting',
      type: 'relationship',
      relationTo: 'meetings',
      required: true,
    },
  ],
  timestamps: true,
}
