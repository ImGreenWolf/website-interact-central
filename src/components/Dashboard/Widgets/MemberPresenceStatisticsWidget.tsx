import type { WidgetServerProps } from 'payload'

import { formatRotaryYearLabel, getRotaryYearStart } from '@/utilities/rotaryYear'

import { BreakdownList, ProgressBar, StatGrid, StatItem, WidgetCard } from './shared'
import { getPresenceOverview } from './presenceData'
import { formatNumber } from './widgetUtils'

export default async function MemberPresenceStatisticsWidget({ req }: WidgetServerProps) {
  const now = new Date()
  const overview = await getPresenceOverview(req.payload, now)

  return (
    <WidgetCard
      actionHref="/admin/collections/attendance"
      actionLabel="Prezență"
      eyebrow={formatRotaryYearLabel(getRotaryYearStart(now))}
      title="Statistici prezență membri"
    >
      <StatGrid>
        <StatItem label="Rată prezență" value={`${overview.attendanceRate}%`} />
        <StatItem label="Membri monitorizați" value={formatNumber(overview.memberCount)} />
        <StatItem label="Întâlniri trecute" value={formatNumber(overview.meetingCount)} />
        <StatItem
          helper="Include înregistrările de prezență lipsă"
          label="Absențe"
          tone="danger"
          value={formatNumber(overview.absent)}
        />
      </StatGrid>
      <ProgressBar label="Prezență efectivă" value={overview.attendanceRate} />
      <BreakdownList
        items={[
          { label: 'Prezenți', tone: 'success', value: overview.present },
          { label: 'Întârziați', tone: 'warning', value: overview.late },
          { label: 'Absențe motivate', value: overview.motivated },
          { label: 'Absenți', tone: 'danger', value: overview.absent },
        ]}
      />
    </WidgetCard>
  )
}
