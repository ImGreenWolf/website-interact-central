import type { PayloadRequest, WidgetInstance } from 'payload'

export default async function prDirectorDashboardLayout({
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
      widgetSlug: 'last-meeting-statistic',
      width: 'medium',
    },
  ]
}
