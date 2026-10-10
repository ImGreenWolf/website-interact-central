import type { PayloadRequest, WidgetInstance } from 'payload'
import type { User } from '@/payload-types'

import treasurerDashboardLayout from './Layouts/treasurer'
import prDirectorDashboardLayout from './Layouts/pr-director'
import presidentDashboardLayout from './Layouts/president'
import secretaryDashboardLayout from './Layouts/secretary'
import hrDirectorDashboardLayout from './Layouts/hr-director'

type RoleDashboardLayout = (args: { req: PayloadRequest }) => Promise<Array<WidgetInstance>>

const roleDashboards: Partial<Record<NonNullable<User['role']>, RoleDashboardLayout>> = {
  'HR Director': hrDirectorDashboardLayout,
  'PR Director': prDirectorDashboardLayout,
  'Past-President': presidentDashboardLayout,
  Președinte: presidentDashboardLayout,
  Secretar: secretaryDashboardLayout,
  Trezorier: treasurerDashboardLayout,
  Vicepreședinte: presidentDashboardLayout,
}

export default async function dashboardLayout({
  req,
}: {
  req: PayloadRequest
}): Promise<Array<WidgetInstance>> {
  const { user } = req

  if (!user?.role) return []

  const roleLayout = roleDashboards[user.role]

  return [
    {
      widgetSlug: 'intro-widget',
      width: 'full',
    },
    ...(roleLayout ? await roleLayout({ req }) : []),
  ]
}
