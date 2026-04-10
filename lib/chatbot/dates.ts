import "server-only"

type DateParseResult = { kind: "date"; iso: string } | { kind: "ambiguous"; question: string }
const CLOSED_WEEKDAYS = new Set([1, 2])

const WEEKDAY_INDEX: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
}

const INDEX_WEEKDAY: Record<number, string> = {
  0: "domingo",
  1: "lunes",
  2: "martes",
  3: "miércoles",
  4: "jueves",
  5: "viernes",
  6: "sábado",
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function partsInTz(now: Date, tz: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const parts = formatter.formatToParts(now)
  const year = Number(parts.find((p) => p.type === "year")?.value)
  const month = Number(parts.find((p) => p.type === "month")?.value)
  const day = Number(parts.find((p) => p.type === "day")?.value)

  if (!year || !month || !day) {
    throw new Error(`No se pudo resolver fecha en zona ${tz}`)
  }

  return { year, month, day }
}

function isoFromParts(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function isValidDateParts(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1) return false
  return day <= daysInMonth(year, month)
}

function weekdayFromISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay()
}

function isoTodayInTz(now: Date, tz: string) {
  const parts = partsInTz(now, tz)
  return isoFromParts(parts.year, parts.month, parts.day)
}

function normalizeYear(yearText?: string) {
  if (!yearText) return undefined
  const year = Number(yearText)
  if (!Number.isFinite(year)) return undefined
  return yearText.length === 2 ? 2000 + year : year
}

function resolveDayOnly(day: number, now: Date, tz: string) {
  if (!Number.isFinite(day) || day < 1 || day > 31) return undefined

  const today = partsInTz(now, tz)
  let year = today.year
  let month = today.month

  if (day < today.day || day > daysInMonth(year, month)) {
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  while (day > daysInMonth(year, month)) {
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  return isoFromParts(year, month, day)
}

function resolveDayMonth(day: number, month: number, now: Date, tz: string, explicitYear?: number) {
  if (!Number.isFinite(day) || !Number.isFinite(month) || day < 1 || day > 31 || month < 1 || month > 12) {
    return undefined
  }

  if (explicitYear !== undefined) {
    return isValidDateParts(explicitYear, month, day) ? isoFromParts(explicitYear, month, day) : undefined
  }

  const today = partsInTz(now, tz)
  let year = today.year
  if (!isValidDateParts(year, month, day)) {
    return undefined
  }

  const candidate = isoFromParts(year, month, day)
  if (candidate < isoTodayInTz(now, tz)) {
    year += 1
    if (!isValidDateParts(year, month, day)) {
      return undefined
    }
  }

  return isoFromParts(year, month, day)
}

function parseSlashDate(normalizedText: string, now: Date, tz: string) {
  const match = normalizedText.match(/\b(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (!match) return undefined

  const day = Number(match[1])
  const month = Number(match[2])
  const year = normalizeYear(match[3])
  return resolveDayMonth(day, month, now, tz, year)
}

function parseDayOnlyText(normalizedText: string, now: Date, tz: string) {
  const trimmed = normalizedText.trim()
  const directMatch = trimmed.match(/^(\d{1,2})$/)
  if (directMatch) {
    return resolveDayOnly(Number(directMatch[1]), now, tz)
  }

  const contextualPatterns = [
    /\bpara\s+el\s+dia\s+(\d{1,2})\b/,
    /\bpara\s+el\s+(\d{1,2})\b/,
    /\bel\s+dia\s+(\d{1,2})\b/,
    /\bdia\s+(\d{1,2})\b/,
    /^el\s+(\d{1,2})$/,
  ]

  for (const pattern of contextualPatterns) {
    const match = trimmed.match(pattern)
    if (match) {
      return resolveDayOnly(Number(match[1]), now, tz)
    }
  }

  return undefined
}

function parseWeekday(normalizedText: string) {
  const match = normalizedText.match(/\b(?:el|este|para el|para este)?\s*(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/)
  if (!match) return undefined
  return WEEKDAY_INDEX[match[1] ?? ""]
}

function nextWeekdayFromISO(baseISO: string, targetWeekday: number) {
  const currentWeekday = weekdayFromISO(baseISO)
  const offset = (targetWeekday - currentWeekday + 7) % 7
  return addDaysISO(baseISO, offset, "UTC")
}

export function addDaysISO(isoOrDate: string | Date, days: number, tz: string): string {
  const baseISO = typeof isoOrDate === "string" ? isoOrDate : isoTodayInTz(isoOrDate, tz)
  const [year, month, day] = baseISO.split("-").map(Number)
  const base = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1))
  base.setUTCDate(base.getUTCDate() + days)
  return isoFromParts(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate())
}

export function earliestPickupDateISO(now: Date, leadDays: number, tz: string) {
  return addDaysISO(now, leadDays, tz)
}

export function isClosedPickupDate(iso: string) {
  return CLOSED_WEEKDAYS.has(weekdayFromISO(iso))
}

export function nextOpenPickupDateISO(iso: string) {
  let candidate = iso
  while (isClosedPickupDate(candidate)) {
    candidate = addDaysISO(candidate, 1, "UTC")
  }
  return candidate
}

export function formatDateEs(iso: string, tz: string) {
  const [year, month, day] = iso.split("-").map(Number)
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12, 0, 0))
  const weekday = new Intl.DateTimeFormat("es-ES", { timeZone: tz, weekday: "long" }).format(date).toLowerCase()
  const dd = String(day ?? 1).padStart(2, "0")
  const mm = String(month ?? 1).padStart(2, "0")
  return `${weekday} ${dd}/${mm}`
}

export function parseSpanishDesiredDate(text: string, now: Date, tz: string): DateParseResult | null {
  const normalizedText = normalize(text)
  const todayISO = isoTodayInTz(now, tz)

  const hasManana = /\bmanana\b/.test(normalizedText)
  const hasPasadoManana = /\bpasado manana\b/.test(normalizedText)
  const weekday = parseWeekday(normalizedText)

  if (hasPasadoManana) {
    return { kind: "date", iso: addDaysISO(todayISO, 2, tz) }
  }

  if (hasManana && weekday !== undefined) {
    const tomorrowISO = addDaysISO(todayISO, 1, tz)
    if (weekdayFromISO(tomorrowISO) === weekday) {
      return { kind: "date", iso: tomorrowISO }
    }

    const weekdayLabel = INDEX_WEEKDAY[weekday] ?? "ese día"
    return {
      kind: "ambiguous",
      question: `¿Te refieres a mañana o al próximo ${weekdayLabel}?`,
    }
  }

  if (hasManana) {
    return { kind: "date", iso: addDaysISO(todayISO, 1, tz) }
  }

  if (/\bhoy\b/.test(normalizedText)) {
    return { kind: "date", iso: todayISO }
  }

  if (weekday !== undefined) {
    return { kind: "date", iso: nextWeekdayFromISO(todayISO, weekday) }
  }

  const slashDate = parseSlashDate(normalizedText, now, tz)
  if (slashDate) {
    return { kind: "date", iso: slashDate }
  }

  const dayOnly = parseDayOnlyText(normalizedText, now, tz)
  if (dayOnly) {
    return { kind: "date", iso: dayOnly }
  }

  return null
}
