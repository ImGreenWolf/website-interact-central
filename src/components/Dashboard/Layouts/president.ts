import type { PayloadRequest, WidgetInstance } from 'payload'

export default async function presidentDashboardLayout({
  req: _req,
}: {
  req: PayloadRequest
}): Promise<Array<WidgetInstance>> {



  return [
    
    {
      widgetSlug: 'meetings-management',
      width: 'small',
    },
    {
      widgetSlug: 'member-presence-statistics',
      width: 'large',
    },
    {
      widgetSlug: 'last-meeting-statistic',
      width: 'x-small',
    },
    {
      widgetSlug: 'member-presence-graph',
      width: 'x-large',
    },
    
  ]
}
