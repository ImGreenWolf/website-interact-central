export function getRelationId(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)

  if (typeof value === 'object') {
    if ('id' in value && value.id !== null && value.id !== undefined) {
      return String(value.id)
    }

    if ('_id' in value && value._id !== null && value._id !== undefined) {
      return String(value._id)
    }

    if ('toString' in value && typeof value.toString === 'function') {
      const stringValue = value.toString()

      if (stringValue !== '[object Object]') return stringValue
    }
  }

  return ''
}

export const numberFormatter = new Intl.NumberFormat('ro-RO')

export const currencyFormatter = new Intl.NumberFormat('ro-RO', {
  currency: 'RON',
  maximumFractionDigits: 0,
  style: 'currency',
})

export const shortDateFormatter = new Intl.DateTimeFormat('ro-RO', {
  day: 'numeric',
  month: 'short',
})

export const dateTimeFormatter = new Intl.DateTimeFormat('ro-RO', {
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
})

export function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

export function formatNumber(value: number) {
  return numberFormatter.format(value)
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

export function formatShortDate(value?: string | null) {
  if (!value) return 'Fără dată'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Dată invalidă'

  return shortDateFormatter.format(date)
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Fără dată'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Dată invalidă'

  return dateTimeFormatter.format(date)
}

export function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0

  return Math.round((numerator / denominator) * 100)
}
