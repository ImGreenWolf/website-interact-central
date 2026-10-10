import type { WidgetServerProps } from 'payload'

import { formatRotaryYearLabel, getRotaryYearStart } from '@/utilities/rotaryYear'

import { BarGraph, CompactTable, WidgetCard } from './shared'
import { getPresenceGraphData } from './presenceData'
import { formatNumber } from './widgetUtils'

export default async function MemberPresenceGraphWidget({ req }: WidgetServerProps) {
  const now = new Date()
  const points = await getPresenceGraphData(req.payload, now)

  return (
    <WidgetCard
      actionHref="/admin/collections/meetings"
      actionLabel="Întâlniri"
      eyebrow={formatRotaryYearLabel(getRotaryYearStart(now))}
      title="Grafic prezență membri"
    >
      <BarGraph
        bars={points.map((point) => ({
          helper: `${formatNumber(point.present + point.late)}/${formatNumber(point.total)}`,
          label: point.label,
          value: point.rate,
        }))}
        emptyLabel="Nu există încă întâlniri finalizate."
      />
      <CompactTable
        emptyLabel="Nu există date despre întâlniri."
        rows={points
          .slice(-3)
          .reverse()
          .map((point) => ({
            href: `/admin/collections/meetings/${point.id}`,
            label: point.label,
            meta: `${formatNumber(point.present + point.late)} prezenți, ${formatNumber(point.absent)} absenți`,
            value: `${point.rate}%`,
          }))}
      />
    </WidgetCard>
  )
}
