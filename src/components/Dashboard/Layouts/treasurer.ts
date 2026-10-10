import type { PayloadRequest, WidgetInstance } from 'payload'

export default async function treasurerDashboardLayout({
  req: _req,
}: {
  req: PayloadRequest
}): Promise<Array<WidgetInstance>> {
  return [
    {
      widgetSlug: 'member-presence-statistics',
      width: 'medium',
    },
    {
      widgetSlug: 'last-meeting-statistic',
      width: 'medium',
    },
  ]
}
