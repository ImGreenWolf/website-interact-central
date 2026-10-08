import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { board, boardAdminAccess } from '../access/roles'

export const Meetings: CollectionConfig = {
  slug: 'meetings',
  access: {
    admin: boardAdminAccess,
    create: board,
    delete: board,
    read: anyone,
    update: board,
  },
   admin: {
    useAsTitle: 'meetingDate',
    components: {
      views:
        {
          root:  {
            Component: {path: '@/components/Checkin', },
             path: '/checkin',
             
            // default: {
            //   tab: {label: 'dkdk', href: 'scanner'},
            //   Component: {path: '@/components/Attendance', }
            // }
          }
        } 
    }
  },
  fields: [
    {
      name: 'meetingDate',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime'
        }
      },
      type: 'date',
      required: true,
    },
    {
      name: 'attendance',
      type: 'join',
      collection: 'attendances',
      on: 'meeting',
      hasMany: true
    },
    {
      name: 'location',
      type: 'json',
    }
  ],
  timestamps: true,
}
