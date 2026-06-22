export const DROP_LAUNCH_TIME_ZONE = "Atlantic/Canary"
export const DEFAULT_DROP_LAUNCH_LOCAL = "2026-07-01T00:00"
export const DEFAULT_DROP_LAUNCH_AT_UTC = "2026-06-30T23:00:00.000Z"

export type DropPublicStatus = "INACTIVE" | "PRELAUNCH" | "LIVE" | "SOLD_OUT" | "CLOSED"

export type DropStockNumbers = {
  stockTotal: number
  reservedUnits: number
  orderedUnits: number
  availableStock: number
}

export type DropPhaseInput = {
  isActive: boolean
  isClosed?: boolean | null
  launchAt: string | Date
  availableStock: number
}

export function getDropPublicStatus(input: DropPhaseInput, now: Date = new Date()): DropPublicStatus {
  if (!input.isActive) return "INACTIVE"
  if (input.isClosed) return "CLOSED"
  if (input.availableStock <= 0) return "SOLD_OUT"

  const launchAt = input.launchAt instanceof Date ? input.launchAt : new Date(input.launchAt)
  if (!Number.isFinite(launchAt.getTime())) return "INACTIVE"

  return now.getTime() < launchAt.getTime() ? "PRELAUNCH" : "LIVE"
}

export function isDropPrelaunch(input: DropPhaseInput, now: Date = new Date()) {
  return getDropPublicStatus(input, now) === "PRELAUNCH"
}

export function isDropPurchasable(input: DropPhaseInput, now: Date = new Date()) {
  return getDropPublicStatus(input, now) === "LIVE"
}

export function computeAvailableDropStock(stock: Omit<DropStockNumbers, "availableStock">) {
  return Math.max(0, stock.stockTotal - stock.reservedUnits - stock.orderedUnits)
}

export function formatDropPrice(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/\u00A0/g, " ")
}

export function parseDropOptionList(value: string | string[] | null | undefined) {
  const raw = Array.isArray(value) ? value : (value ?? "").split(/[\n,]/)
  const seen = new Set<string>()
  const options: string[] = []

  for (const entry of raw) {
    const normalized = entry.trim().replace(/\s+/g, " ")
    if (!normalized) continue
    const key = normalized.toLocaleLowerCase("es")
    if (seen.has(key)) continue
    seen.add(key)
    options.push(normalized)
  }

  return options
}

export function parseDropImageList(value: string | string[] | null | undefined) {
  return parseDropOptionList(value).filter((entry) => /^\/|^https?:\/\//i.test(entry))
}

function readDateTimePartsInZone(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant)

  const values = new Map(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    second: Number(values.get("second")),
  }
}

function getTimeZoneOffsetMs(instant: Date, timeZone: string) {
  const parts = readDateTimePartsInZone(instant, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - instant.getTime()
}

export function localDateTimeToUtcIso(value: string, timeZone = DROP_LAUNCH_TIME_ZONE) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) {
    throw new Error("Fecha de lanzamiento inválida")
  }

  const [, year, month, day, hour, minute] = match
  const utcGuess = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0)
  const firstPass = new Date(utcGuess - getTimeZoneOffsetMs(new Date(utcGuess), timeZone))
  const secondPass = new Date(utcGuess - getTimeZoneOffsetMs(firstPass, timeZone))

  return secondPass.toISOString()
}

export function utcIsoToDateTimeLocalInZone(value: string | null | undefined, timeZone = DROP_LAUNCH_TIME_ZONE) {
  if (!value) return DEFAULT_DROP_LAUNCH_LOCAL
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return DEFAULT_DROP_LAUNCH_LOCAL

  const parts = readDateTimePartsInZone(date, timeZone)
  const pad = (input: number) => String(input).padStart(2, "0")
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

export function getDropStatusLabel(status: DropPublicStatus) {
  const labels: Record<DropPublicStatus, string> = {
    INACTIVE: "Inactivo",
    PRELAUNCH: "Preventa",
    LIVE: "En venta",
    SOLD_OUT: "Agotado",
    CLOSED: "Cerrado",
  }

  return labels[status]
}
