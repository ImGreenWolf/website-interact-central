import type { PayloadRequest, WidgetInstance } from 'payload'

export default async function prDirectorDashboardLayout({
  req: _req,
}: {
  req: PayloadRequest
}): Promise<Array<WidgetInstance>> {



  return [
    {
      widgetSlug: 'gallery-submission',
      width: 'x-large',
    },
    {
      widgetSlug: 'last-meeting-statistic',
      width: 'x-small',
    },
    {
      widgetSlug: 'event-statistics',
      width: 'medium',
    },
  ]
}
