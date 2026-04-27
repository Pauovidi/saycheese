import { earliestPickupDateISO, formatDateEs, parseSpanishDesiredDate, resolveRequestedPickupDate } from "@/lib/chatbot/date-rules"
import { CLOSED_PICKUP_DAYS_COPY } from "@/src/data/business"

type ResolvedPickupDate = ReturnType<typeof resolveRequestedPickupDate>

export type OrderPickupDateValidation =
  | { kind: "missing"; earliestDate: string }
  | ResolvedPickupDate

export function validateOrderPickupDate(
  requestedDate: string | null | undefined,
  now: Date,
  leadDays: number,
  tz: string
): OrderPickupDateValidation {
  const normalizedDate = requestedDate?.trim()

  if (!normalizedDate) {
    return {
      kind: "missing",
      earliestDate: earliestPickupDateISO(now, leadDays, tz),
    }
  }

  const parsedDate = parseSpanishDesiredDate(normalizedDate, now, tz)
  const resolvedInputDate = parsedDate?.kind === "date" ? parsedDate.iso : normalizedDate

  return resolveRequestedPickupDate(resolvedInputDate, now, leadDays, tz)
}

export function getOrderPickupDateErrorMessage(
  validation: Exclude<OrderPickupDateValidation, { kind: "valid" }>,
  leadDays: number,
  tz: string
) {
  if (validation.kind === "missing") {
    return `La fecha de recogida es obligatoria. La primera fecha disponible es ${formatDateEs(validation.earliestDate, tz)}.`
  }

  if (validation.kind === "too_soon") {
    return `Para esa fecha no llegamos: trabajamos con un mínimo de ${leadDays} días. La primera fecha disponible es ${formatDateEs(validation.earliestDate, tz)}.`
  }

  if (validation.kind === "invalid") {
    return `No pude validar esa fecha. Indícala como DD/MM o AAAA-MM-DD. La primera fecha disponible es ${formatDateEs(validation.earliestDate, tz)}.`
  }

  return `No hacemos recogidas el ${formatDateEs(validation.requestedDate, tz)} porque ${CLOSED_PICKUP_DAYS_COPY}. La siguiente fecha disponible es ${formatDateEs(validation.nextAvailableDate, tz)}.`
}
