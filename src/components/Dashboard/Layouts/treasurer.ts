import type { PayloadRequest, WidgetInstance } from 'payload'

export default async function treasurerDashboardLayout({
  req: _req,
}: {
  req: PayloadRequest
}): Promise<Array<WidgetInstance>> {



  return [
    {
      widgetSlug: 'dues-statistics',
      width: 'medium',
    },
    {
      widgetSlug: 'member-presence-statistics',
      width: 'medium',
    },
    {
      widgetSlug: 'dues-management',
      width: 'full',
    },
  ]
}
