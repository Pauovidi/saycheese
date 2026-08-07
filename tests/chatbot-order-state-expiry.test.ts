import assert from "node:assert/strict"
import test from "node:test"

import { extractFreshOrderState, serializeOrderState } from "../lib/chatbot/order-state"

const NOW = new Date("2026-08-04T12:27:00.000Z")

test("caduca un pedido incompleto antiguo sin perder teléfono ni guardas de duplicado", () => {
  const content = serializeOrderState(
    {
      inOrderFlow: true,
      awaitingName: true,
      customerName: "Cheesecake de happy hippo",
      finalDate: "2026-08-05",
      phone: "+34600000000",
      lastCreatedOrderId: "pedido-previo",
      lastCreatedOrderAt: "2026-07-23T19:05:00.000Z",
      lastCreatedOrderFingerprint: "huella",
    },
    new Date("2026-07-23T18:50:00.000Z")
  )

  const state = extractFreshOrderState([{ role: "system", content }], NOW)

  assert.equal(state.inOrderFlow, false)
  assert.equal(state.awaitingName, undefined)
  assert.equal(state.customerName, undefined)
  assert.equal(state.finalDate, undefined)
  assert.equal(state.phone, "+34600000000")
  assert.equal(state.lastCreatedOrderId, "pedido-previo")
})

test("conserva un pedido incompleto reciente", () => {
  const content = serializeOrderState(
    { inOrderFlow: true, flavor: "lotus", awaitingName: true },
    new Date("2026-08-04T10:00:00.000Z")
  )

  const state = extractFreshOrderState([{ role: "system", content }], NOW)

  assert.equal(state.inOrderFlow, true)
  assert.equal(state.flavor, "lotus")
  assert.equal(state.awaitingName, true)
})
