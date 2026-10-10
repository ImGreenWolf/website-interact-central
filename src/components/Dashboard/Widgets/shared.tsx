import type { CSSProperties, ReactNode } from 'react'

import { formatNumber, formatPercent } from './widgetUtils'

const colors = {
  accent: 'var(--theme-success-500, #2f855a)',
  border: 'var(--theme-elevation-150, #d9d9d9)',
  danger: 'var(--theme-error-500, #c92a2a)',
  muted: 'var(--theme-elevation-500, #6b7280)',
  panel: 'var(--theme-elevation-50, #f6f6f6)',
  text: 'var(--theme-text, #111827)',
  warning: 'var(--theme-warning-500, #b7791f)',
}

const cardStyle: CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  height: '100%',
  padding: 20,
  justifyContent: 'flex-start'
}

const titleStyle: CSSProperties = {
  fontSize: 18,
  lineHeight: 1.25,
  margin: 0,
}

const eyebrowStyle: CSSProperties = {
  color: colors.muted,
  fontSize: 12,
  fontWeight: 600,
  margin: 0,
  textTransform: 'uppercase',
}

const actionStyle: CSSProperties = {
  alignItems: 'center',
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  color: colors.text,
  display: 'inline-flex',
  fontSize: 13,
  fontWeight: 600,
  minHeight: 32,
  padding: '0 10px',
  textDecoration: 'none',
}

export function WidgetCard(props: {
  actionHref?: string
  actionLabel?: string
  children: ReactNode
  eyebrow?: string
  title: string
}) {
  return (
    <section className="card" style={cardStyle}>
      <header
        style={{
          alignItems: 'flex-start',
          display: 'flex',
          gap: 12,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'grid', gap: 4 }}>
          {props.eyebrow ? <p style={eyebrowStyle}>{props.eyebrow}</p> : null}
          <h2 style={titleStyle}>{props.title}</h2>
        </div>
        {props.actionHref && props.actionLabel ? (
          <a href={props.actionHref} style={actionStyle}>
            {props.actionLabel}
          </a>
        ) : null}
      </header>
      {props.children}
    </section>
  )
}

export function StatGrid(props: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 10,
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
      }}
    >
      {props.children}
    </div>
  )
}

export function StatItem(props: {
  helper?: string
  label: string
  tone?: 'danger' | 'muted' | 'warning'
  value: ReactNode
}) {
  const toneColor =
    props.tone === 'danger'
      ? colors.danger
      : props.tone === 'warning'
        ? colors.warning
        : colors.text

  return (
    <div
      style={{
        background: colors.panel,
        borderRadius: 6,
        display: 'grid',
        gap: 4,
        minHeight: 88,
        padding: 12,
      }}
    >
      <span style={{ color: colors.muted, fontSize: 12 }}>{props.label}</span>
      <strong style={{ color: toneColor, fontSize: 26, lineHeight: 1.1 }}>{props.value}</strong>
      {props.helper ? (
        <span style={{ color: colors.muted, fontSize: 12, lineHeight: 1.35 }}>{props.helper}</span>
      ) : null}
    </div>
  )
}

export function ProgressBar(props: {
  label: string
  tone?: 'danger' | 'success' | 'warning'
  value: number
}) {
  const barColor =
    props.tone === 'danger'
      ? colors.danger
      : props.tone === 'warning'
        ? colors.warning
        : colors.accent

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: colors.muted, fontSize: 13 }}>{props.label}</span>
        <strong style={{ fontSize: 13 }}>{formatPercent(props.value)}</strong>
      </div>
      <div
        style={{
          background: 'var(--theme-elevation-100, #ececec)',
          borderRadius: 999,
          height: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: barColor,
            borderRadius: 999,
            height: '100%',
            width: `${Math.max(0, Math.min(100, props.value))}%`,
          }}
        />
      </div>
    </div>
  )
}

export function BreakdownList(props: {
  items: Array<{ label: string; tone?: 'danger' | 'success' | 'warning'; value: number | string }>
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {props.items.map((item) => {
        const dotColor =
          item.tone === 'danger'
            ? colors.danger
            : item.tone === 'warning'
              ? colors.warning
              : item.tone === 'success'
                ? colors.accent
                : colors.muted

        return (
          <div
            key={item.label}
            style={{
              alignItems: 'center',
              display: 'flex',
              gap: 8,
              justifyContent: 'space-between',
            }}
          >
            <span style={{ alignItems: 'center', color: colors.muted, display: 'flex', gap: 8 }}>
              <span
                aria-hidden
                style={{
                  background: dotColor,
                  borderRadius: 999,
                  display: 'inline-block',
                  height: 8,
                  width: 8,
                }}
              />
              {item.label}
            </span>
            <strong>
              {typeof item.value === 'number' ? formatNumber(item.value) : item.value}
            </strong>
          </div>
        )
      })}
    </div>
  )
}

export function BarGraph(props: {
  bars: Array<{ helper?: string; label: string; value: number }>
  emptyLabel: string
}) {
  if (props.bars.length === 0) {
    return <p style={{ color: colors.muted, margin: 0 }}>{props.emptyLabel}</p>
  }

  return (
    <div
      style={{
        alignItems: 'end',
        display: 'grid',
        gap: 10,
        gridTemplateColumns: `repeat(${props.bars.length}, minmax(38px, 1fr))`,
        minHeight: 190,
      }}
    >
      {props.bars.map((bar) => {
        const value = Math.max(0, Math.min(100, bar.value))

        return (
          <div key={bar.label} style={{ display: 'grid', gap: 8, minWidth: 0 }}>
            <div
              style={{
                alignItems: 'end',
                background: colors.panel,
                borderRadius: 6,
                display: 'flex',
                height: 120,
                overflow: 'hidden',
              }}
              title={`${bar.label}: ${formatPercent(value)}`}
            >
              <div
                style={{
                  background:
                    value >= 75 ? colors.accent : value >= 50 ? colors.warning : colors.danger,
                  height: `${value}%`,
                  width: '100%',
                }}
              />
            </div>
            <div style={{ display: 'grid', gap: 2, textAlign: 'center' }}>
              <strong style={{ fontSize: 13 }}>{formatPercent(value)}</strong>
              <span style={{ color: colors.muted, fontSize: 11, overflowWrap: 'anywhere' }}>
                {bar.label}
              </span>
              {bar.helper ? (
                <span style={{ color: colors.muted, fontSize: 11 }}>{bar.helper}</span>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ActionList(props: {
  items: Array<{ href: string; label: string; meta?: string }>
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {props.items.map((item) => (
        <a
          href={item.href}
          key={item.href}
          style={{
            alignItems: 'center',
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            color: colors.text,
            display: 'flex',
            gap: 12,
            justifyContent: 'space-between',
            minHeight: 42,
            padding: '0 12px',
            textDecoration: 'none',
          }}
        >
          <span style={{ fontWeight: 600 }}>{item.label}</span>
          {item.meta ? (
            <span style={{ color: colors.muted, fontSize: 12 }}>{item.meta}</span>
          ) : null}
        </a>
      ))}
    </div>
  )
}

export function CompactTable(props: {
  emptyLabel: string
  rows: Array<{ href?: string; label: string; meta?: string; value: string }>
}) {
  if (props.rows.length === 0) {
    return <p style={{ color: colors.muted, margin: 0 }}>{props.emptyLabel}</p>
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {props.rows.map((row) => {
        const content = (
          <>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <strong>{row.label}</strong>
              {row.meta ? (
                <span style={{ color: colors.muted, display: 'block', fontSize: 12 }}>
                  {row.meta}
                </span>
              ) : null}
            </span>
            <strong style={{ whiteSpace: 'nowrap' }}>{row.value}</strong>
          </>
        )

        if (row.href) {
          return (
            <a
              href={row.href}
              key={`${row.label}-${row.value}`}
              style={{
                alignItems: 'center',
                borderBottom: `1px solid ${colors.border}`,
                color: colors.text,
                display: 'flex',
                gap: 12,
                justifyContent: 'space-between',
                padding: '0 0 8px',
                textDecoration: 'none',
              }}
            >
              {content}
            </a>
          )
        }

        return (
          <div
            key={`${row.label}-${row.value}`}
            style={{
              alignItems: 'center',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              gap: 12,
              justifyContent: 'space-between',
              padding: '0 0 8px',
            }}
          >
            {content}
          </div>
        )
      })}
    </div>
  )
}
