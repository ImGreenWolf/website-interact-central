import type { PayloadRequest, WidgetInstance } from 'payload'
import tresourerDashboardLayout from './Layouts/treasurer'
import prDirectorDashboardLayout from './Layouts/pr-director'
import presidentDashboardLayout from './Layouts/president'
import secretaryDashboardLayout from './Layouts/secretary'
import hrDirectorDashboardLayout from './Layouts/hr-director'

export default async function dashboardLayout({
  req,
}: {
  req: PayloadRequest
}): Promise<Array<WidgetInstance>> {
  // return [
  //   {
  //     widgetSlug: 'member-presence-statistics',
  //     width: 'medium',
  //   },
  //   {
  //     widgetSlug: 'member-presence-graph',
  //     width: 'large',
  //   },
  //   {
  //     widgetSlug: 'last-meeting-statistic',
  //     width: 'medium',
  //   },
  //   {
  //     widgetSlug: 'meetings-management',
  //     width: 'medium',
  //   },
  //   {
  //     widgetSlug: 'event-statistics',
  //     width: 'medium',
  //   },
  //   {
  //     widgetSlug: 'gallery-submission',
  //     width: 'medium',
  //   },
  //   {
  //     widgetSlug: 'dues-statistics',
  //     width: 'medium',
  //   },
  //   {
  //     widgetSlug: 'dues-management',
  //     width: 'medium',
  //   },
  // ]
const {user} = req
// const rolesDashboard:  Partial<Record<BoardRole, typeof dashboardLayout>> = {
//     treasurer: tresourerDashboardLayout,
//     "pr-director": prDirectorDashboardLayout,
//     "president": presidentDashboardLayout,
//     "vice-president": presidentDashboardLayout,
//     "hr-director": hrDirectorDashboardLayout,
//     secretary: secretaryDashboardLayout,
//     "past-president": presidentDashboardLayout


// }
if(!user || !user.role) return [];

return [
    {
        widgetSlug: 'intro-widget',
        width: 'full'
    },
    // ...rolesDashboard[(user.role as BoardRole)]  ? (await rolesDashboard[(user.role as BoardRole)]!({req})) : []
    ...(await presidentDashboardLayout({req}))
]
}
