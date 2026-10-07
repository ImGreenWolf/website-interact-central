import type { AdminViewServerProps } from 'payload'

import { Button } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'

import { isBoardMember } from '@/access/roles'

export function AttendanceDisplayRouteButton({ payload, user }: AdminViewServerProps) {
  if (!isBoardMember(user)) {
    return null
  }

  return (
    <Button
      buttonStyle="secondary"
      el="link"
      size="medium"
      to={formatAdminURL({
        adminRoute: payload.config.routes.admin,
        path: '/collections/attendances/display',
      })}
    >
      Display
    </Button>
  )
}
