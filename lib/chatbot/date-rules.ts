import { isPickupWeekdayOpen } from "@/src/data/business"

type DateParseResult = { kind: "date"; iso: string } | { kind: "ambiguous"; question: string }
type PickupDateResolution =
  | { kind: "valid"; requestedDate: string; pickupDate: string }
  | { kind: "too_soon"; requestedDate: string; earliestDate: string }
  | { kind: "closed"; requestedDate: string; nextAvailableDate: string }
  | { kind: "invalid"; requestedDate: string; earliestDate: string }

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

const MONTH_INDEX: Record<string, number> = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  setiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
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

function partsFromISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  return {
    year: year ?? 1970,
    month: month ?? 1,
    day: day ?? 1,
  }
}

function parseISODateParts(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return undefined

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!isValidDateParts(year, month, day)) return undefined
  return { year, month, day, iso: isoFromParts(year, month, day) }
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
  const { year, month, day } = partsFromISO(iso)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
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

function findNextValidMonthDay(year: number, month: number, day: number) {
  for (let offset = 0; offset < 24; offset += 1) {
    const totalMonths = month - 1 + offset
    const candidateYear = year + Math.floor(totalMonths / 12)
    const candidateMonth = (totalMonths % 12) + 1
    if (isValidDateParts(candidateYear, candidateMonth, day)) {
      return isoFromParts(candidateYear, candidateMonth, day)
    }
  }

  return undefined
}

function resolveMonthDayCandidate(day: number, month: number, todayISO: string, explicitYear?: number) {
  const { year: todayYear } = partsFromISO(todayISO)
  const baseYear = explicitYear ?? todayYear
  if (!isValidDateParts(baseYear, month, day)) return undefined

  const candidate = isoFromParts(baseYear, month, day)
  if (explicitYear || candidate >= todayISO) {
    return candidate
  }

  const nextYear = baseYear + 1
  if (!isValidDateParts(nextYear, month, day)) return undefined
  return isoFromParts(nextYear, month, day)
}

function parseMonthNameDate(normalizedText: string, todayISO: string) {
  const match = normalizedText.match(
    /\b(?:para\s+el\s+)?(?:el\s+)?(\d{1,2})\s*(?:de\s+)?(ene|enero|feb|febrero|mar|marzo|abr|abril|may|mayo|jun|junio|jul|julio|ago|agosto|sep|sept|septiembre|setiembre|oct|octubre|nov|noviembre|dic|diciembre)(?:\s+de\s+(\d{2,4}))?\b/
  )
  if (!match) return undefined

  const day = Number(match[1])
  const month = MONTH_INDEX[match[2] ?? ""]
  const parsedYear = match[3] ? Number(match[3]) : undefined
  const year = parsedYear
    ? parsedYear < 100
      ? 2000 + parsedYear
      : parsedYear
    : undefined

  if (!month) return undefined
  return resolveMonthDayCandidate(day, month, todayISO, year)
}

export function parsePartialDateFromText(text: string, now: Date, tz: string) {
  const normalizedText = normalize(text)
  const todayISO = isoTodayInTz(now, tz)
  const { year, month, day: todayDay } = partsFromISO(todayISO)

  const monthDayDate = parseMonthNameDate(normalizedText, todayISO)
  if (monthDayDate) {
    return monthDayDate
  }

  const partialMatch =
    normalizedText.match(/\b(?:para(?: el)?|el)\s+(\d{1,2})\b(?![/-])/)
    ?? normalizedText.match(/^\s*(\d{1,2})\s*$/)

  if (!partialMatch) return undefined

  const day = Number(partialMatch[1])
  if (day < 1 || day > 31) return undefined

  if (day >= todayDay && isValidDateParts(year, month, day)) {
    return isoFromParts(year, month, day)
  }

  return findNextValidMonthDay(year, month + 1, day)
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
  const { year: todayYear } = partsFromISO(todayISO)
  const year = parsedYear
    ? parsedYear < 100
      ? 2000 + parsedYear
      : parsedYear
    : todayYear

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
  const { year, month, day } = partsFromISO(baseISO)
  const base = new Date(Date.UTC(year, month - 1, day))
  base.setUTCDate(base.getUTCDate() + days)
  return isoFromParts(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate())
}

export function isBusinessOpenOnDate(iso: string) {
  return isPickupWeekdayOpen(weekdayFromISO(iso))
}

export function getNextAvailablePickupDate(iso: string) {
  let candidate = iso
  while (!isBusinessOpenOnDate(candidate)) {
    candidate = addDaysISO(candidate, 1, "UTC")
  }

  return candidate
}

export function earliestPickupDateISO(now: Date, leadDays: number, tz: string) {
  return getNextAvailablePickupDate(addDaysISO(now, leadDays, tz))
}

export function formatDateEs(iso: string, tz: string) {
  const { year, month, day } = partsFromISO(iso)
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const weekday = new Intl.DateTimeFormat("es-ES", { timeZone: tz, weekday: "long" }).format(date).toLowerCase()
  const dd = String(day).padStart(2, "0")
  const mm = String(month).padStart(2, "0")
  return `${weekday} ${dd}/${mm}`
}

export function resolveRequestedPickupDate(requestedISO: string, now: Date, leadDays: number, tz: string): PickupDateResolution {
  const todayISO = isoTodayInTz(now, tz)
  const earliestDate = earliestPickupDateISO(now, leadDays, tz)
  const requested = parseISODateParts(requestedISO)

  if (!requested) {
    return {
      kind: "invalid",
      requestedDate: requestedISO,
      earliestDate,
    }
  }

  const normalizedRequestedISO = requested.iso

  if (!isBusinessOpenOnDate(normalizedRequestedISO)) {
    let nextAvailableDate = getNextAvailablePickupDate(normalizedRequestedISO)
    if (nextAvailableDate < earliestDate) {
      nextAvailableDate = earliestDate
    }

    return {
      kind: "closed",
      requestedDate: normalizedRequestedISO,
      nextAvailableDate,
    }
  }

  if (normalizedRequestedISO < todayISO || normalizedRequestedISO < earliestDate) {
    return {
      kind: "too_soon",
      requestedDate: normalizedRequestedISO,
      earliestDate,
    }
  }

  return {
    kind: "valid",
    requestedDate: normalizedRequestedISO,
    pickupDate: normalizedRequestedISO,
  }
}

export function parseSpanishDesiredDate(text: string, now: Date, tz: string): DateParseResult | null {
  const normalizedText = normalize(text)
  const todayISO = isoTodayInTz(now, tz)
  const numericDate = parseNumericDate(normalizedText, todayISO)
  const partialDate = parsePartialDateFromText(text, now, tz)

  const hasManana = /\bmanana\b/.test(normalizedText)
  const hasPasadoManana = /\bpasado manana\b/.test(normalizedText)
  const weekday = parseWeekday(normalizedText)

  if (numericDate) {
    if (weekday !== undefined && weekdayFromISO(numericDate) !== weekday) {
      const weekdayLabel = INDEX_WEEKDAY[weekday] ?? "ese día"
      return {
        kind: "ambiguous",
        question: `El ${formatDateEs(numericDate, tz)} cae ${INDEX_WEEKDAY[weekdayFromISO(numericDate)]}, no ${weekdayLabel}. ¿Quieres que lo apunte para ${formatDateEs(numericDate, tz)}?`,
      }
    }

    return { kind: "date", iso: numericDate }
  }

  if (partialDate) {
    return { kind: "date", iso: partialDate }
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
