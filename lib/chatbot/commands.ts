export function normalizeChatCommand(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export function isWhatsappConversationResetCommand(channel: "web" | "whatsapp", message: string) {
  if (channel !== "whatsapp") return false

  const normalized = normalizeChatCommand(message)
  return [/\breiniciar\b/, /\breset\b/, /\bempezar\s+de\s+nuevo\b/].some((pattern) => pattern.test(normalized))
}
