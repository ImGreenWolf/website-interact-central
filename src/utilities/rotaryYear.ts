export function getRotaryYearStart(date = new Date()) {
  return date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1
}

export function getRotaryYearRange(rotaryYearStart = getRotaryYearStart()) {
  return {
    endExclusive: new Date(rotaryYearStart + 1, 6, 1, 0, 0, 0, 0),
    start: new Date(rotaryYearStart, 6, 1, 0, 0, 0, 0),
  }
}

export function getRotaryYearEnd(rotaryYearStart = getRotaryYearStart()) {
  return new Date(rotaryYearStart + 1, 5, 30, 23, 59, 59, 999)
}

export function formatRotaryYearLabel(rotaryYearStart: number) {
  return `Anul Rotary ${rotaryYearStart}-${rotaryYearStart + 1}`
}

export function isDateInRotaryYear(
  value: Date | string | null | undefined,
  rotaryYearStart = getRotaryYearStart(),
) {
  if (!value) return false

  const date = typeof value === 'string' ? new Date(value) : value

  if (Number.isNaN(date.getTime())) return false

  const range = getRotaryYearRange(rotaryYearStart)

  return date >= range.start && date < range.endExclusive
}

export function getRotaryYearQueryBounds(rotaryYearStart: number, now = new Date()) {
  const range = getRotaryYearRange(rotaryYearStart)
  const isCurrentOrFutureYear = now < range.endExclusive

  return {
    end: isCurrentOrFutureYear ? now : range.endExclusive,
    endOperator: isCurrentOrFutureYear ? 'less_than_equal' : 'less_than',
    start: range.start,
  } as const
}

export function getRotaryYearStartsFromDates(
  values: Array<Date | string | null | undefined>,
  now = new Date(),
) {
  const currentYear = getRotaryYearStart(now)
  const years = new Set<number>([currentYear])
  let earliestYear = currentYear

  values.forEach((value) => {
    if (!value) return

    const date = typeof value === 'string' ? new Date(value) : value

    if (!Number.isNaN(date.getTime())) {
      const year = getRotaryYearStart(date)
      years.add(year)
      earliestYear = Math.min(earliestYear, year)
    }
  })

  for (let year = currentYear; year >= earliestYear; year -= 1) {
    years.add(year)
  }

  return Array.from(years).sort((left, right) => right - left)
}
