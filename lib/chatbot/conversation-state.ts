import { HUMAN_SUPPORT_PHONE_DISPLAY } from "@/src/data/business"

export const ORDER_CLOSED_MESSAGE = `Tu pedido está en marcha. Para más información, puedes contactarnos en el ${HUMAN_SUPPORT_PHONE_DISPLAY}.`

type ConversationGateInput = {
  botPausedUntil?: Date | null
  orderClosed?: boolean
  now?: Date
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
