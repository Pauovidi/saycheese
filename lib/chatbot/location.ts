import { normalizeChatText } from "@/lib/chatbot/order-intake"
import { STORE_ADDRESS } from "@/src/data/business"

export const SAFE_LOCATION_FALLBACK =
  "Te confirmo la ubicación exacta con el equipo para no darte un dato incorrecto."

const LOCATION_PATTERNS = [
  /\bdonde\s+(?:estais|estan|estamos|esta|queda|se\s+encuentra)\b/,
  /\bdonde\s+esta\s+(?:la\s+)?tienda\b/,
  /\bdonde\s+queda\s+(?:la\s+)?tienda\b/,
  /\bubicacion\b/,
  /\bdireccion\b/,
  /\bteneis\s+tienda\s+fisica\b/,
  /\btienes?\s+tienda\s+fisica\b/,
  /\btienda\s+fisica\b/,
  /\bobrador\b/,
  /\bcomo\s+llegar\b/,
  /\blocal\b/,
  /\btienda\b/,
] as const

export function hasStoreLocationIntent(text: string) {
  const normalized = normalizeChatText(text).replace(/[!?.,;:]/g, " ").replace(/\s+/g, " ").trim()
  return LOCATION_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function buildStoreLocationMessage(address = STORE_ADDRESS) {
  const safeAddress = address.trim()
  if (!safeAddress) {
    return SAFE_LOCATION_FALLBACK
  }

  return `Tenemos tienda física y obrador en ${safeAddress}. Además, suele haber stock diario limitado de tamaños mini y medianas hasta agotar existencias.`
}

export function buildStoreLocationReplyIfIntent(text: string, address = STORE_ADDRESS) {
  return hasStoreLocationIntent(text) ? buildStoreLocationMessage(address) : null
}

export function hasUnsafeStoreAddressClaim(text: string) {
  return /\barapiles\b/i.test(text) || /\bcalle\s+arapiles\b/i.test(text) || /\btienda\b[\s\S]{0,80}\bmadrid\b/i.test(text)
}
