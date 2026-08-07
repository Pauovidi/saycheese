import type { OrderState } from "@/lib/chatbot/order-flow"

export const ORDER_STATE_PREFIX = "__ORDER_STATE__:"
export const ORDER_STATE_TTL_MS = 6 * 60 * 60 * 1000

type StoredChatMessage = {
  role: string
  content: string
  createdAt?: string
}

function inactiveStateFrom(state: OrderState): OrderState {
  return {
    phone: state.phone,
    inOrderFlow: false,
    lastCreatedOrderId: state.lastCreatedOrderId,
    lastCreatedOrderAt: state.lastCreatedOrderAt,
    lastCreatedOrderFingerprint: state.lastCreatedOrderFingerprint,
  }
}

export function serializeOrderState(state: OrderState, now = new Date()) {
  return `${ORDER_STATE_PREFIX}${JSON.stringify({ ...state, updatedAt: now.toISOString() })}`
}

export function extractFreshOrderState(
  messages: StoredChatMessage[],
  now = new Date(),
  ttlMs = ORDER_STATE_TTL_MS
): OrderState {
  const stateMessage = [...messages]
    .reverse()
    .find((message) => message.role === "system" && message.content.startsWith(ORDER_STATE_PREFIX))

  if (!stateMessage) return {}

  try {
    const parsed = JSON.parse(stateMessage.content.slice(ORDER_STATE_PREFIX.length)) as OrderState
    if (!parsed) return {}

    const timestamp = parsed.updatedAt ?? stateMessage.createdAt
    const timestampMs = timestamp ? new Date(timestamp).getTime() : Number.NaN
    const hasActiveOrder = Boolean(
      parsed.inOrderFlow || parsed.awaitingConfirm || parsed.awaitingName || parsed.awaitingAdditionalCakeDecision
    )

    if (hasActiveOrder && Number.isFinite(timestampMs) && now.getTime() - timestampMs > ttlMs) {
      return inactiveStateFrom(parsed)
    }

    return parsed
  } catch {
    return {}
  }
}
