export const DEFAULT_BOT_WHATSAPP_LINK = "https://wa.me/15559306629"
export const DEFAULT_BOT_WHATSAPP_MESSAGE = "Hola, quiero hacer un pedido."

export function normalizeWhatsAppLink(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed?.length ? trimmed : DEFAULT_BOT_WHATSAPP_LINK
}

export function buildWhatsAppLink(baseUrl: string, message = DEFAULT_BOT_WHATSAPP_MESSAGE) {
  const normalizedBaseUrl = normalizeWhatsAppLink(baseUrl)
  const separator = normalizedBaseUrl.includes("?") ? "&" : "?"
  return `${normalizedBaseUrl}${separator}text=${encodeURIComponent(message.trim())}`
}
