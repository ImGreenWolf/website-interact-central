import type { WidgetServerProps } from 'payload'

import { formatRotaryYearLabel, getRotaryYearStart } from '@/utilities/rotaryYear'

import { BreakdownList, ProgressBar, StatGrid, StatItem, WidgetCard } from './shared'
import { getPresenceGraphData } from './presenceData'
import { formatNumber } from './widgetUtils'

export default async function LastMeetingStatisticWidget({ req }: WidgetServerProps) {
  const now = new Date()
  const [lastMeeting] = (await getPresenceGraphData(req.payload, now, 1)).reverse()

  return (
    <WidgetCard
      actionHref={
        lastMeeting
          ? `/admin/collections/meetings/${lastMeeting.id}`
          : '/admin/collections/meetings'
      }
      actionLabel="Deschide"
      eyebrow={formatRotaryYearLabel(getRotaryYearStart(now))}
      title="Statisticile ultimei întâlniri"
    >
      {!lastMeeting ? (
        <p style={{ color: 'var(--theme-elevation-500, #6b7280)', margin: 0 }}>
          Nu există încă întâlniri finalizate.
        </p>
      ) : (
        <>
          <StatGrid>
            <StatItem label="Rata prezenței" value={`${lastMeeting.rate}%`} />
            <StatItem
              label="Participanți"
              value={`${formatNumber(lastMeeting.present + lastMeeting.late)} / ${formatNumber(lastMeeting.total)}`}
            />
          </StatGrid>
          <ProgressBar label={lastMeeting.label} value={lastMeeting.rate} />
          <BreakdownList
            items={[
              { label: 'Prezenți', tone: 'success', value: lastMeeting.present },
              { label: 'Întârziați', tone: 'warning', value: lastMeeting.late },
              { label: 'Motivați', value: lastMeeting.motivated },
              { label: 'Absenți', tone: 'danger', value: lastMeeting.absent },
            ]}
          />
        </>
      )}
    </WidgetCard>
  )
}
