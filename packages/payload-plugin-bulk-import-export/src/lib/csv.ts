export type ParsedCSVRow = {
  cells: string[]
  rowNumber: number
}

export type ParsedCSV = {
  delimiter: ',' | ';'
  headers: string[]
  rows: ParsedCSVRow[]
}

export type CSVParseResult = {
  errors: { message: string; row: number }[]
  parsed?: ParsedCSV
}

export function parseCSV(input: string): CSVParseResult {
  const csv = input.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(csv)
  const rawRows = parseCSVRows(csv, delimiter).filter((row) =>
    row.cells.some((cell) => cell.trim()),
  )
  const [headerRow, ...rows] = rawRows

  if (!headerRow) {
    return {
      errors: [{ message: 'CSV file is empty.', row: 1 }],
    }
  }

  const headers = headerRow.cells.map((header) => header.trim())
  const seenHeaders = new Map<string, number>()
  const errors: { message: string; row: number }[] = []

  headers.forEach((header, index) => {
    const normalized = normalizeColumnName(header)

    if (!normalized) {
      errors.push({
        message: `Column ${index + 1} has an empty header.`,
        row: headerRow.rowNumber,
      })
      return
    }

    const previousIndex = seenHeaders.get(normalized)

    if (previousIndex !== undefined) {
      errors.push({
        message: `Duplicate header "${header}" also appears in column ${previousIndex + 1}.`,
        row: headerRow.rowNumber,
      })
      return
    }

    seenHeaders.set(normalized, index)
  })

  if (errors.length > 0) return { errors }

  return {
    errors: [],
    parsed: {
      delimiter,
      headers,
      rows,
    },
  }
}

export function normalizeColumnName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('ro')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '')
}

export function findHeader(headers: string[], name: string) {
  const normalizedName = normalizeColumnName(name)

  return headers.find(
    (header) => normalizeColumnName(header) === normalizedName,
  )
}

export function getCell(row: ParsedCSVRow, headers: string[], header: string) {
  const index = headers.findIndex(
    (candidate) =>
      normalizeColumnName(candidate) === normalizeColumnName(header),
  )

  if (index === -1) return ''

  return (row.cells[index] ?? '').trim()
}

function parseCSVRows(input: string, delimiter: ',' | ';') {
  const rows: ParsedCSVRow[] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let rowNumber = 1

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const nextChar = input[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell)
      cell = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      row.push(cell)
      rows.push({ cells: row, rowNumber })
      row = []
      cell = ''
      rowNumber += 1

      if (char === '\r' && nextChar === '\n') index += 1
      continue
    }

    cell += char
  }

  row.push(cell)
  rows.push({ cells: row, rowNumber })

  return rows
}

function detectDelimiter(input: string): ',' | ';' {
  const firstLine = input.split(/\r?\n/, 1)[0] ?? ''
  let commas = 0
  let semicolons = 0
  let inQuotes = false

  for (const char of firstLine) {
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (inQuotes) continue
    if (char === ',') commas += 1
    if (char === ';') semicolons += 1
  }

  return semicolons > commas ? ';' : ','
}
