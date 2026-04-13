import { HUMAN_SUPPORT_PHONE_DISPLAY } from "@/src/data/business"

export const ORDER_CLOSED_MESSAGE = `Tu pedido está en marcha. Para más información, puedes contactarnos en el ${HUMAN_SUPPORT_PHONE_DISPLAY}.`

type ConversationGateInput = {
  botPausedUntil?: Date | null
  orderClosed?: boolean
  now?: Date
}

type ConversationMessage = {
  role: string
  content: string
}

const LEGACY_POST_ORDER_HANDOFF_MARKERS = ["te paso con un humano", "te atiende una persona"]
const GENERIC_POST_ORDER_USER_MESSAGES = new Set(["hola", "buenos dias", "buenas", "ok", "vale", "gracias"])

function normalizeConversationText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function resolveConversationGate({ botPausedUntil, orderClosed, now = new Date() }: ConversationGateInput) {
  if (botPausedUntil && botPausedUntil > now) {
    return "paused_handoff" as const
  }

  if (orderClosed) {
    return "order_closed" as const
  }

  return "normal" as const
}

export function shouldRecoverLegacyClosedOrderPause(messages: ConversationMessage[]) {
  const recentMessages = messages.filter((message) => message.role !== "system").slice(-6)

  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const assistantMessage = recentMessages[index]
    if (assistantMessage?.role !== "assistant") {
      continue
    }

    const normalizedAssistant = normalizeConversationText(assistantMessage.content)
    const looksLikeLegacyHandoff = LEGACY_POST_ORDER_HANDOFF_MARKERS.some((marker) =>
      normalizedAssistant.includes(marker)
    )

    if (!looksLikeLegacyHandoff) {
      continue
    }

    const previousMessages = recentMessages.slice(0, index)
    const latestUserMessage = [...previousMessages].reverse().find((message) => message.role === "user")
    if (!latestUserMessage) {
      return false
    }

    const normalizedUser = normalizeConversationText(latestUserMessage.content)
    const looksLikeGenericFollowUp = GENERIC_POST_ORDER_USER_MESSAGES.has(normalizedUser)
    const hasOrderCreationEarlier = previousMessages.some(
      (message) =>
        message.role === "assistant" &&
        normalizeConversationText(message.content).startsWith("pedido creado ")
    )

    return looksLikeGenericFollowUp && hasOrderCreationEarlier
  }

  return false
}
