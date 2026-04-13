import test from "node:test"
import assert from "node:assert/strict"

import { ORDER_CLOSED_MESSAGE, resolveConversationGate } from "@/lib/chatbot/conversation-state"

test("el mensaje fijo post-pedido usa el telefono humano centralizado", () => {
  assert.equal(
    ORDER_CLOSED_MESSAGE,
    "Tu pedido está en marcha. Para más información, puedes contactarnos en el +34 681 14 71 49."
  )
})

test("si existe una pausa humana real, tiene prioridad sobre order_closed", () => {
  const gate = resolveConversationGate({
    orderClosed: true,
    botPausedUntil: new Date("2099-01-01T12:00:00.000Z"),
    now: new Date("2026-04-13T10:00:00.000Z"),
  })

  assert.equal(gate, "paused_handoff")
})

test("si el pedido ya esta cerrado y no hay pausa humana activa, entra en la rama fija post-pedido", () => {
  const gate = resolveConversationGate({
    orderClosed: true,
    botPausedUntil: new Date("2026-04-13T09:00:00.000Z"),
    now: new Date("2026-04-13T10:00:00.000Z"),
  })

  assert.equal(gate, "order_closed")
})
