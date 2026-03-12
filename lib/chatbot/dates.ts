import "server-only"

type DateParseResult = { kind: "date"; iso: string } | { kind: "ambiguous"; question: string }

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

function isValidDateParts(year: number, month: number, day: number) {
  const candidate = new Date(Date.UTC(year, month - 1, day))
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  )
}

function weekdayFromISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay()
}

function isoTodayInTz(now: Date, tz: string) {
  const parts = partsInTz(now, tz)
  return isoFromParts(parts.year, parts.month, parts.day)
}

function parseWeekday(normalizedText: string) {
  const match = normalizedText.match(/\b(?:el|este|para el|para este)?\s*(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/)
  if (!match) return undefined
  return WEEKDAY_INDEX[match[1] ?? ""]
}

function parseNumericDate(normalizedText: string, todayISO: string) {
  const isoMatch = normalizedText.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (isoMatch) {
    const year = Number(isoMatch[1])
    const month = Number(isoMatch[2])
    const day = Number(isoMatch[3])
    if (isValidDateParts(year, month, day)) {
      return isoFromParts(year, month, day)
    }
  }

  const shortMatch = normalizedText.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (!shortMatch) return undefined

  const day = Number(shortMatch[1])
  const month = Number(shortMatch[2])
  const parsedYear = shortMatch[3] ? Number(shortMatch[3]) : undefined
  const [todayYear] = todayISO.split("-").map(Number)
  const year = parsedYear
    ? parsedYear < 100
      ? 2000 + parsedYear
      : parsedYear
    : todayYear ?? new Date().getUTCFullYear()

  if (!isValidDateParts(year, month, day)) return undefined

  let candidate = isoFromParts(year, month, day)
  if (!parsedYear && candidate < todayISO) {
    const nextYear = year + 1
    if (!isValidDateParts(nextYear, month, day)) return undefined
    candidate = isoFromParts(nextYear, month, day)
  }

  return candidate
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
  const numericDate = parseNumericDate(normalizedText, todayISO)

  const hasManana = /\bmanana\b/.test(normalizedText)
  const hasPasadoManana = /\bpasado manana\b/.test(normalizedText)
  const weekday = parseWeekday(normalizedText)

  if (numericDate) {
    return { kind: "date", iso: numericDate }
  }

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

  return null
}
