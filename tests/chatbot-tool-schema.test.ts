import test from "node:test"
import assert from "node:assert/strict"

import { createOrderInputSchema } from "../lib/chatbot/order-schema"
import { CREATE_ORDER_TOOL_PARAMETERS, CANCEL_ORDER_TOOL_PARAMETERS, HANDOFF_TO_HUMAN_TOOL_PARAMETERS } from "../lib/chatbot/tool-schemas"

test("create_order declara todas sus keys en required y permite email y notas nulos", () => {
  assert.deepEqual(CREATE_ORDER_TOOL_PARAMETERS.required, [
    "customer_name",
    "customer_email",
    "phone",
    "delivery_date",
    "notes",
    "items",
  ])
  assert.deepEqual(CREATE_ORDER_TOOL_PARAMETERS.properties.customer_email.type, ["string", "null"])
  assert.deepEqual(CREATE_ORDER_TOOL_PARAMETERS.properties.notes.type, ["string", "null"])
})

test("los tools strict con strings opcionales los modelan como nullable required", () => {
  assert.deepEqual(CANCEL_ORDER_TOOL_PARAMETERS.required, ["phone", "order_hint"])
  assert.deepEqual(CANCEL_ORDER_TOOL_PARAMETERS.properties.order_hint.type, ["string", "null"])
  assert.deepEqual(HANDOFF_TO_HUMAN_TOOL_PARAMETERS.required, ["reason"])
  assert.deepEqual(HANDOFF_TO_HUMAN_TOOL_PARAMETERS.properties.reason.type, ["string", "null"])
})

test("el pedido sigue siendo válido sin email si el tool envía null", () => {
  const parsed = createOrderInputSchema.safeParse({
    customer_name: "Pau",
    customer_email: null,
    phone: "645290441",
    delivery_date: "2026-05-01",
    notes: null,
    items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
  })

  assert.equal(parsed.success, true)
})
