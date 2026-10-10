import type { PayloadRequest, WidgetInstance } from 'payload'

export default async function secretaryDashboardLayout({
  req: _req,
}: {
  req: PayloadRequest
}): Promise<Array<WidgetInstance>> {



  return [
    {
      widgetSlug: 'member-presence-graph',
      width: 'medium',
    },
    {
      widgetSlug: 'member-presence-statistics',
      width: 'medium',
    },
    {
      widgetSlug: 'meetings-management',
      width: 'medium',
    },
    {
      widgetSlug: 'last-meeting-statistic',
      width: 'medium',
    },
    {
      widgetSlug: 'event-statistics',
      width: 'medium',
    },
  ]
}
