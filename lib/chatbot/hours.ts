import { normalizeChatText } from "@/lib/chatbot/order-intake"
import { STORE_HOURS_TEXT } from "@/src/data/business"

const STORE_HOURS_PATTERNS = [
  /\bhorarios?\b/,
  /\b(?:abris|abren|abre|abrimos|abierto|abierta|abiertos|abiertas|apertura|cerrais|cierran|cierra|cerramos|cerrado|cerrada|cerrados|cerradas|cierre)\b/,
  /\b(?:a|hasta|desde)\s+que\s+hora\b/,
  /\b(?:cuando|que\s+dias?)\b.*\b(?:abrir|cerrar|recoger|recogida|pasar|ir|venir)\b/,
] as const

export function buildStoreHoursReplyIfIntent(message: string) {
  const normalized = normalizeChatText(message)
  const closingOrder = /\b(?:cierra|cierre|cerrado|cerrada)\s+(?:(?:el|mi|este|la)\s+)?(?:pedido|encargo|reserva)\b|\b(?:pedido|encargo|reserva)\s+cerrad[oa]\b/.test(normalized)
  if (closingOrder && !/\b(?:hora|horarios?)\b/.test(normalized)) return null
  return STORE_HOURS_PATTERNS.some((pattern) => pattern.test(normalized)) ? STORE_HOURS_TEXT : null
}
