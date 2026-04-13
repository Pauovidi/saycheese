import test from "node:test"
import assert from "node:assert/strict"

import {
  ORDER_CLOSED_MESSAGE,
  resolveConversationGate,
  shouldRecoverLegacyClosedOrderPause,
} from "@/lib/chatbot/conversation-state"

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

test("recupera una pausa legacy cuando el pedido ya estaba creado y el usuario solo saludo despues", () => {
  const shouldRecover = shouldRecoverLegacyClosedOrderPause([
    {
      role: "assistant",
      content: "Pedido creado. Recogida el miércoles 15/04. Solo recogida en tienda. No hacemos envíos.",
    },
    { role: "user", content: "hola" },
    {
      role: "assistant",
      content: "Te paso con un humano para que te atienda mejor. Si quieres, también te pueden responder por WhatsApp en +1 641 429 4476.",
    },
  ])

  assert.equal(shouldRecover, true)
})

test("no recupera una pausa humana real cuando el usuario pidio hablar con una persona", () => {
  const shouldRecover = shouldRecoverLegacyClosedOrderPause([
    {
      role: "assistant",
      content: "Pedido creado. Recogida el miércoles 15/04. Solo recogida en tienda. No hacemos envíos.",
    },
    { role: "user", content: "quiero hablar con una persona" },
    {
      role: "assistant",
      content: "Si lo prefieres, te atiende una persona en el +34 681 14 71 49.",
    },
  ])

  assert.equal(shouldRecover, false)
})
