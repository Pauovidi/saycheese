export const DROP_LAUNCH_TIME_ZONE = "Atlantic/Canary"
export const DEFAULT_DROP_LAUNCH_LOCAL = "2026-07-01T00:00"
export const DEFAULT_DROP_LAUNCH_AT_UTC = "2026-06-30T23:00:00.000Z"
export const DEFAULT_DROP_PREORDER_CTA_TEXT = "Preventa"
export const DEFAULT_DROP_PREORDER_LIMIT = 30
export const MAX_DROP_PREORDER_CTA_LENGTH = 60

export type DropPublicStatus = "INACTIVE" | "PRELAUNCH" | "LIVE" | "SOLD_OUT" | "CLOSED"

export type DropStockNumbers = {
  stockTotal: number
  reservedUnits: number
  orderedUnits: number
  availableStock: number
  sizeStock: DropSizeStockNumbers[]
}

export type DropSizeStockNumbers = {
  size: string
  stockTotal: number
  orderedUnits: number
  availableRaw: number
  sellableNow: number
  position: number
}

export type DropPhaseInput = {
  isActive: boolean
  isClosed?: boolean | null
  archivedAt?: string | null
  launchAt: string | Date
  availableStock: number
}

export function getDropPublicStatus(input: DropPhaseInput, now: Date = new Date()): DropPublicStatus {
  if (!input.isActive) return "INACTIVE"
  if (input.archivedAt) return "CLOSED"
  if (input.isClosed) return "CLOSED"

  const launchAt = input.launchAt instanceof Date ? input.launchAt : new Date(input.launchAt)
  if (!Number.isFinite(launchAt.getTime())) return "INACTIVE"

  if (now.getTime() < launchAt.getTime()) return "PRELAUNCH"
  return input.availableStock <= 0 ? "SOLD_OUT" : "LIVE"
}

export function isDropPrelaunch(input: DropPhaseInput, now: Date = new Date()) {
  return getDropPublicStatus(input, now) === "PRELAUNCH"
}

export function isDropPurchasable(input: DropPhaseInput, now: Date = new Date()) {
  return getDropPublicStatus(input, now) === "LIVE"
}

export function computeAvailableDropStock(stock: { stockTotal: number; reservedUnits: number; orderedUnits: number }) {
  return Math.max(0, stock.stockTotal - stock.orderedUnits)
}

export function computePreorderRemaining(preorderLimit: number, reservedUnits: number) {
  return Math.max(0, Math.trunc(preorderLimit) - Math.max(0, Math.trunc(reservedUnits)))
}

export function computeDropSizeSellableNow(input: {
  sizeStockTotal: number
  orderedUnitsBySize: number
  globalAvailable: number
}) {
  const availableRaw = Math.max(0, input.sizeStockTotal - input.orderedUnitsBySize)
  return Math.max(0, Math.min(availableRaw, input.globalAvailable))
}

export function buildDropSizeStockNumbers(input: {
  sizes: string[]
  sizeStockTotals?: Array<{ size: string; stockTotal: number; position?: number }>
  orderedUnitsBySize?: Record<string, number>
  globalAvailable: number
}): DropSizeStockNumbers[] {
  const configured = new Map(
    (input.sizeStockTotals ?? []).map((entry, index) => [
      entry.size.trim().toLocaleLowerCase("es"),
      {
        size: entry.size.trim(),
        stockTotal: Math.max(0, Math.trunc(Number(entry.stockTotal) || 0)),
        position: Number.isFinite(entry.position) ? Number(entry.position) : index,
      },
    ])
  )
  const sizes = input.sizes.length ? input.sizes : Array.from(configured.values()).sort((a, b) => a.position - b.position).map((entry) => entry.size)

  return sizes.map((size, index) => {
    const key = size.trim().toLocaleLowerCase("es")
    const config = configured.get(key)
    const stockTotal = config?.stockTotal ?? 0
    const orderedUnits = Math.max(0, Math.trunc(Number(input.orderedUnitsBySize?.[key]) || 0))
    const availableRaw = Math.max(0, stockTotal - orderedUnits)

    return {
      size,
      stockTotal,
      orderedUnits,
      availableRaw,
      sellableNow: Math.max(0, Math.min(availableRaw, input.globalAvailable)),
      position: config?.position ?? index,
    }
  })
}

export function normalizeDropSizeStock(
  sizesInput: string | string[] | null | undefined,
  stockInput: Array<{ size?: string; stockTotal?: number | string; position?: number | string }> | null | undefined
) {
  const sizes = parseDropOptionList(sizesInput)
  const seen = new Map<string, { size: string; stockTotal: number; position: number }>()

  for (const [index, entry] of (stockInput ?? []).entries()) {
    const size = String(entry.size ?? "").trim().replace(/\s+/g, " ")
    if (!size) continue
    const key = size.toLocaleLowerCase("es")
    if (seen.has(key)) continue
    const parsedStock = Number(entry.stockTotal ?? 0)
    const parsedPosition = Number(entry.position ?? index)
    seen.set(key, {
      size,
      stockTotal: Math.max(0, Math.trunc(Number.isFinite(parsedStock) ? parsedStock : 0)),
      position: Number.isFinite(parsedPosition) ? Math.trunc(parsedPosition) : index,
    })
  }

  for (const size of sizes) {
    const key = size.toLocaleLowerCase("es")
    if (!seen.has(key)) {
      seen.set(key, { size, stockTotal: 0, position: seen.size })
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.position - b.position)
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

export function normalizeDropPreorderCtaText(value: string | null | undefined) {
  const normalized = (value ?? DEFAULT_DROP_PREORDER_CTA_TEXT).trim()
  return normalized || DEFAULT_DROP_PREORDER_CTA_TEXT
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
