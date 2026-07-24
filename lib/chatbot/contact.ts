import { normalizeChatText } from "@/lib/chatbot/order-intake"
import { HUMAN_SUPPORT_PHONE_DISPLAY } from "@/src/data/business"

const CONTACT_PHONE_PATTERNS = [
  /\b(?:que|cual)\s+(?:es\s+)?(?:(?:vuestro|vuestra|su|el)\s+)?(?:numero|telefono)(?:\s+de\s+contacto)?\b/,
  /\b(?:numero|telefono)\s+de\s+contacto\b/,
  /\b(?:a\s+)?que\s+(?:numero|telefono)\s+(?:puedo|debo|tengo\s+que)\s+llamar\b/,
  /\b(?:puedo|podria|como)\s+llamar(?:os|les)?\b/,
  /\bquiero\s+(?:llamar(?:os|les)?|hablar\s+por\s+telefono)\b/,
  /\bcontactar(?:os|les)?\s+por\s+telefono\b/,
] as const

export function hasHumanSupportPhoneIntent(text: string) {
  const normalized = normalizeChatText(text).replace(/[!?.,;:]/g, " ").replace(/\s+/g, " ").trim()
  return CONTACT_PHONE_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function buildHumanSupportPhoneMessage(phone = HUMAN_SUPPORT_PHONE_DISPLAY) {
  return `Puedes llamarnos al ${phone}.`
}

export function buildHumanSupportPhoneReplyIfIntent(text: string) {
  return hasHumanSupportPhoneIntent(text) ? buildHumanSupportPhoneMessage() : null
}
