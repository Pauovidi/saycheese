export const HUMAN_SUPPORT_PHONE_RAW = "681147149"
export const HUMAN_SUPPORT_PHONE_E164 = "+34681147149"
export const HUMAN_SUPPORT_PHONE_DISPLAY = "+34 681 14 71 49"
export const HUMAN_SUPPORT_WHATSAPP_LINK = "https://wa.me/34681147149"
export const MOBILE_LAUNCHER_WHATSAPP_PHONE_E164 = "+16414294476"
export const MOBILE_LAUNCHER_WHATSAPP_LINK = "https://wa.me/16414294476"

export const PICKUP_ONLY_COPY = "Solo recogida en tienda. No hacemos envíos."
export const FORMAT_SIZE_COPY = "Siempre trabajamos con 2 tamaños: grande y cajita."
export const CLOSED_PICKUP_DAYS_COPY = "lunes y martes estamos cerrados"

export type ProductFormat = "tarta" | "cajita"
export type OrderItemType = "cake" | "box"

const CUSTOMER_FACING_FORMAT_LABELS: Record<ProductFormat, string> = {
  tarta: "grande",
  cajita: "cajita",
}

const ORDER_ITEM_TYPE_LABELS: Record<OrderItemType, string> = {
  cake: CUSTOMER_FACING_FORMAT_LABELS.tarta,
  box: CUSTOMER_FACING_FORMAT_LABELS.cajita,
}

export const STORE_HOURS_LINES = [
  "Horario:",
  "Miércoles: 16:30–20:30",
  "Jueves: 16:30–20:30",
  "Viernes: 16:30–20:30",
  "Sábado: 10:00–14:00 y 16:30–20:30",
  "Domingo: 10:00–14:00",
  "Lunes y martes: cerrado.",
  PICKUP_ONLY_COPY,
] as const

export const STORE_HOURS_TEXT = STORE_HOURS_LINES.join("\n")
export const STORE_HOURS_INLINE_TEXT = STORE_HOURS_LINES.join(" ")
export const OPEN_PICKUP_WEEKDAY_INDEXES = [0, 3, 4, 5, 6] as const

export function getCustomerFacingFormatLabel(format: ProductFormat) {
  return CUSTOMER_FACING_FORMAT_LABELS[format]
}

export function getOrderItemTypeLabel(type: OrderItemType) {
  return ORDER_ITEM_TYPE_LABELS[type]
}

export function isPickupWeekdayOpen(weekday: number) {
  return OPEN_PICKUP_WEEKDAY_INDEXES.includes(weekday as typeof OPEN_PICKUP_WEEKDAY_INDEXES[number])
}

export function buildHumanSupportMessage(
  prefix = "Te atiende una persona del equipo aquí:",
  channel: "web" | "whatsapp" = "web"
) {
  if (channel === "whatsapp") {
    return `${prefix} ${HUMAN_SUPPORT_PHONE_DISPLAY}`
  }

  return `${prefix} ${HUMAN_SUPPORT_WHATSAPP_LINK} o llama al ${HUMAN_SUPPORT_PHONE_E164}`
}

export function buildUnconfirmedProductInfoMessage(channel: "web" | "whatsapp" = "web") {
  return `No tengo ese dato confirmado ahora mismo. ${buildHumanSupportMessage("Te atiende un humano aquí:", channel)}`
}
