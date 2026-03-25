export const DEFAULT_BOT_WHATSAPP_LINK = "https://wa.me/15559306629"
export const DEFAULT_BOT_WHATSAPP_MESSAGE = "Hola, quiero hacer un pedido."

export function buildWhatsAppLink(baseUrl: string, message = DEFAULT_BOT_WHATSAPP_MESSAGE) {
  const separator = baseUrl.includes("?") ? "&" : "?"
  return `${baseUrl}${separator}text=${encodeURIComponent(message)}`
}
