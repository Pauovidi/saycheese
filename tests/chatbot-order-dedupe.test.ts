import test from "node:test"
import assert from "node:assert/strict"

import {
  areEquivalentOrderItems,
  buildChatOrderFingerprint,
  buildOrderItemsSignature,
  isRecentDuplicateFingerprint,
} from "../lib/chatbot/order-dedupe"

test("normaliza sabor, nombre y teléfono al construir la huella del pedido", () => {
  const left = buildChatOrderFingerprint({
    customerName: " Pau Ovidi ",
    phone: "+34 645 29 04 41",
    deliveryDate: "2026-05-01",
    items: [{ type: "cake", flavor: "Pistacho", qty: 1 }],
  })

  const right = buildChatOrderFingerprint({
    customerName: "pau ovidi",
    phone: "34645290441",
    deliveryDate: "2026-05-01",
    items: [{ type: "cake", flavor: "pistacho", qty: 1 }],
  })

  assert.equal(left, right)
})

test("detecta equivalencia de items aunque lleguen en distinto orden", () => {
  const left = [
    { type: "box" as const, flavor: "Lotus", qty: 1 },
    { type: "cake" as const, flavor: "Pistacho", qty: 2 },
  ]
  const right = [
    { type: "cake" as const, flavor: "pistacho", qty: 2 },
    { type: "box" as const, flavor: "lotus", qty: 1 },
  ]

  assert.equal(areEquivalentOrderItems(left, right), true)
  assert.equal(buildOrderItemsSignature(left), buildOrderItemsSignature(right))
})

test("solo considera duplicado reciente dentro de la ventana configurada", () => {
  assert.equal(
    isRecentDuplicateFingerprint({
      fingerprint: "abc",
      previousFingerprint: "abc",
      previousCreatedAt: "2026-04-20T10:00:00.000Z",
      now: new Date("2026-04-20T10:09:59.000Z"),
    }),
    true
  )

  assert.equal(
    isRecentDuplicateFingerprint({
      fingerprint: "abc",
      previousFingerprint: "abc",
      previousCreatedAt: "2026-04-20T10:00:00.000Z",
      now: new Date("2026-04-20T10:10:01.000Z"),
    }),
    false
  )
})
