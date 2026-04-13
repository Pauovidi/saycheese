const HUMAN_SUPPORT_COUNTRY_CODE = "34"
const HUMAN_SUPPORT_LOCAL_PHONE = "681147149"
const WHATSAPP_SUPPORT_COUNTRY_CODE = "1"
const WHATSAPP_SUPPORT_LOCAL_PHONE = "6414294476"

function formatSpanishPhoneDisplay(rawPhone: string) {
  return `+34 ${rawPhone.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4")}`
}

function formatUsPhoneDisplay(rawPhone: string) {
  return `+1 ${rawPhone.slice(0, 3)} ${rawPhone.slice(3, 6)} ${rawPhone.slice(6)}`
}

export const HUMAN_SUPPORT_CONTACT = {
  raw: HUMAN_SUPPORT_LOCAL_PHONE,
  display: formatSpanishPhoneDisplay(HUMAN_SUPPORT_LOCAL_PHONE),
  e164: `+${HUMAN_SUPPORT_COUNTRY_CODE}${HUMAN_SUPPORT_LOCAL_PHONE}`,
} as const

export const WHATSAPP_SUPPORT_CONTACT = {
  raw: WHATSAPP_SUPPORT_LOCAL_PHONE,
  display: formatUsPhoneDisplay(WHATSAPP_SUPPORT_LOCAL_PHONE),
  e164: `+${WHATSAPP_SUPPORT_COUNTRY_CODE}${WHATSAPP_SUPPORT_LOCAL_PHONE}`,
  whatsappHref: `https://wa.me/${WHATSAPP_SUPPORT_COUNTRY_CODE}${WHATSAPP_SUPPORT_LOCAL_PHONE}`,
} as const

export const HUMAN_SUPPORT_PHONE_RAW = HUMAN_SUPPORT_CONTACT.raw
export const HUMAN_SUPPORT_PHONE_DISPLAY = HUMAN_SUPPORT_CONTACT.display
export const HUMAN_SUPPORT_PHONE_E164 = HUMAN_SUPPORT_CONTACT.e164
export const HUMAN_SUPPORT_WHATSAPP_LINK = WHATSAPP_SUPPORT_CONTACT.whatsappHref
export const WHATSAPP_SUPPORT_PHONE_RAW = WHATSAPP_SUPPORT_CONTACT.raw
export const WHATSAPP_SUPPORT_PHONE_DISPLAY = WHATSAPP_SUPPORT_CONTACT.display
export const WHATSAPP_SUPPORT_PHONE_E164 = WHATSAPP_SUPPORT_CONTACT.e164

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

export function buildHumanSupportMessage(prefix = "Si lo prefieres, te atiende una persona en el") {
  return `${prefix} ${HUMAN_SUPPORT_PHONE_DISPLAY}.`
}

export function buildUnconfirmedProductInfoMessage() {
  return `No tengo ese dato confirmado ahora mismo. ${buildHumanSupportMessage()}`
}
