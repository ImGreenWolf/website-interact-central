import type { AdminViewServerProps } from 'payload'

import { Gutter } from '@payloadcms/ui'

import { isBoardMember } from '@/access/roles'

import AttendanceView from './index'

export default async function AttendanceDisplayView(props: AdminViewServerProps) {
  if (!isBoardMember(props.user)) {
    return (
      <Gutter>
        <h1>Access denied</h1>
      </Gutter>
    )
  }

  return AttendanceView(props)
}
