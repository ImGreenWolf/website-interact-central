import type { WidgetServerProps } from 'payload'

import type { Meeting } from '@/payload-types'

import { ActionList, CompactTable, StatGrid, StatItem, WidgetCard } from './shared'
import { formatDateTime, formatNumber } from './widgetUtils'

export default async function MeetingsManagementWidget({ req }: WidgetServerProps) {
  const { payload } = req
  const now = new Date()
  const [totalMeetings, upcomingMeetings, latestMeetings] = await Promise.all([
    payload.count({
      collection: 'meetings',
    }),
    payload.find({
      collection: 'meetings',
      depth: 0,
      limit: 3,
      sort: 'meetingDate',
      where: {
        meetingDate: {
          greater_than_equal: now.toISOString(),
        },
      },
    }),
    payload.find({
      collection: 'meetings',
      depth: 0,
      limit: 3,
      sort: '-meetingDate',
      where: {
        meetingDate: {
          less_than: now.toISOString(),
        },
      },
    }),
  ])
  const upcoming = upcomingMeetings.docs as Meeting[]
  const latest = latestMeetings.docs as Meeting[]

  return (
    <WidgetCard
      actionHref="/admin/collections/meetings"
      actionLabel="Administrează"
      eyebrow="Administrare club"
      title="Administrare întâlniri"
    >
      <StatGrid>
        <StatItem label="Total întâlniri" value={formatNumber(totalMeetings.totalDocs)} />
        <StatItem label="Viitoare" value={formatNumber(upcomingMeetings.totalDocs)} />
      </StatGrid>
      <ActionList
        items={[
          {
            href: '/admin/collections/meetings/create',
            label: 'Creează întâlnire',
            meta: 'Înregistrare nouă',
          },
          {
            href: '/admin/collections/attendance/create',
            label: 'Adaugă prezență',
            meta: 'Status membri',
          },
          {
            href: '/admin/collections/absence-motivations',
            label: 'Verifică motivări',
            meta: 'Cereri',
          },
        ]}
      />
      <CompactTable
        emptyLabel="Nu există întâlniri viitoare programate."
        rows={(upcoming.length > 0 ? upcoming : latest).map((meeting) => ({
          href: `/admin/collections/meetings/${meeting.id}`,
          label: upcoming.length > 0 ? 'Întâlnire viitoare' : 'Ultima întâlnire',
          value: formatDateTime(meeting.meetingDate),
        }))}
      />
    </WidgetCard>
  )
}
