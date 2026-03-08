import "server-only"

const SPANISH_WEEKDAY_TO_INDEX: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 0,
}

function normalizeSpanishText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function getDatePartsInTimeZone(now: Date, tz: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const parts = formatter.formatToParts(now)
  const year = Number(parts.find((part) => part.type === "year")?.value)
  const month = Number(parts.find((part) => part.type === "month")?.value)
  const day = Number(parts.find((part) => part.type === "day")?.value)

  if (!year || !month || !day) {
    throw new Error(`No se pudo resolver la fecha local en tz=${tz}`)
  }

  return { year, month, day }
}

function toIsoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function addDaysIso(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number)
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1))
  date.setUTCDate(date.getUTCDate() + days)
  return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

function getWeekdayFromIso(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1))
  return date.getUTCDay()
}

function parseIsoDateFromText(text: string) {
  const isoMatch = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (!isoMatch) return undefined
  return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
}

export function hasSpanishDateIntent(text: string) {
  const normalized = normalizeSpanishText(text)
  if (/\b(20\d{2}-\d{2}-\d{2})\b/.test(normalized)) return true
  if (/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(normalized)) return true
  if (/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(normalized)) return true
  return /\b(para|fecha|dia|cuando)\b/.test(normalized)
}

export function parseSpanishRequestedDate(text: string, now: Date, tz: string): { requestedDate?: string } {
  const normalized = normalizeSpanishText(text)
  const directIso = parseIsoDateFromText(normalized)
  if (directIso) {
    return { requestedDate: directIso }
  }

  const weekdayMatch = normalized.match(/\b(?:el|este|para el|para este)?\s*(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/)
  if (!weekdayMatch) {
    return {}
  }

  const targetWeekday = SPANISH_WEEKDAY_TO_INDEX[weekdayMatch[1] ?? ""]
  if (targetWeekday === undefined) {
    return {}
  }

  const localNow = getDatePartsInTimeZone(now, tz)
  const todayIso = toIsoDate(localNow.year, localNow.month, localNow.day)
  const todayWeekday = getWeekdayFromIso(todayIso)
  const offset = (targetWeekday - todayWeekday + 7) % 7

  return { requestedDate: addDaysIso(todayIso, offset) }
}

export function computeEarliestPickupDate(now: Date, tz: string): string {
  const localNow = getDatePartsInTimeZone(now, tz)
  const todayIso = toIsoDate(localNow.year, localNow.month, localNow.day)
  return addDaysIso(todayIso, 3)
}

export function validateOrSuggestDate(
  requested: string,
  earliest: string
): { ok: boolean; finalDate: string; reason: "requested_before_earliest" | "requested_on_or_after_earliest" } {
  if (requested >= earliest) {
    return { ok: true, finalDate: requested, reason: "requested_on_or_after_earliest" }
  }

  return { ok: false, finalDate: earliest, reason: "requested_before_earliest" }
}
