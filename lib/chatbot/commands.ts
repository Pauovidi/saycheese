export function normalizeChatCommand(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export type ConversationCommandIntent = "whatsapp_reset" | "cancel_order_handoff" | null

export function isWhatsappConversationResetCommand(channel: "web" | "whatsapp", message: string) {
  if (channel !== "whatsapp") return false

  const normalized = normalizeChatCommand(message)
  return [/\breiniciar\b/, /\breset\b/, /\bempezar\s+de\s+nuevo\b/].some((pattern) => pattern.test(normalized))
}

export function hasCancelOrderHandoffIntent(message: string) {
  const normalized = normalizeChatCommand(message)

  return [
    /\b(cancelar|anular|eliminar|borrar)\s+(?:el\s+)?pedido\b/,
    /\b(cancelar|anular|eliminar|borrar)\s+mi\s+pedido\b/,
    /\bquiero\s+(cancelar|anular|eliminar|borrar)\s+(?:el\s+)?pedido\b/,
    /\b(cancelar|anular|eliminar|borrar)\s+(?:la\s+)?reserva\b/,
    /\b(cancelar|anular|eliminar|borrar)\s+(?:el\s+)?encargo\b/,
  ].some((pattern) => pattern.test(normalized))
}

export function resolveConversationCommand(channel: "web" | "whatsapp", message: string): ConversationCommandIntent {
  if (hasCancelOrderHandoffIntent(message)) {
    return "cancel_order_handoff"
  }

  if (isWhatsappConversationResetCommand(channel, message)) {
    return "whatsapp_reset"
  }

  return null
}
