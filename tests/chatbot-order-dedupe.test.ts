import test from "node:test"
import assert from "node:assert/strict"

import {
  appendOrderItem,
  areEquivalentOrderItems,
  buildChatOrderFingerprint,
  buildOrderItemsSignature,
  isRecentDuplicateFingerprint,
} from "../lib/chatbot/order-dedupe"

test("normaliza sabor y teléfono al construir la huella del pedido", () => {
  const left = buildChatOrderFingerprint({
    phone: "+34 645 29 04 41",
    deliveryDate: "2026-05-01",
    items: [{ type: "cake", flavor: "Pistacho", qty: 1 }],
  })

  const right = buildChatOrderFingerprint({
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

test("trata como duplicado accidental el mismo teléfono, día, sabor, tamaño y cantidad", () => {
  const first = buildChatOrderFingerprint({
    phone: "645290441",
    deliveryDate: "2026-05-01",
    items: [{ type: "cake", flavor: "Gofio", qty: 1 }],
  })

  const repeated = buildChatOrderFingerprint({
    phone: "+34 645 29 04 41",
    deliveryDate: "2026-05-01",
    items: [{ type: "cake", flavor: "gofio", qty: 1 }],
  })

  assert.equal(first, repeated)
})

test("permite pedidos del mismo teléfono cuando cambia el día", () => {
  const friday = buildChatOrderFingerprint({
    phone: "645290441",
    deliveryDate: "2026-05-01",
    items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
  })

  const saturday = buildChatOrderFingerprint({
    phone: "645290441",
    deliveryDate: "2026-05-02",
    items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
  })

  assert.notEqual(friday, saturday)
})

test("permite pedidos del mismo teléfono y día cuando cambia sabor, tamaño o cantidad", () => {
  const base = buildChatOrderFingerprint({
    phone: "645290441",
    deliveryDate: "2026-05-01",
    items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
  })

  const differentFlavor = buildChatOrderFingerprint({
    phone: "645290441",
    deliveryDate: "2026-05-01",
    items: [{ type: "cake", flavor: "Pistacho", qty: 1 }],
  })

  const differentSize = buildChatOrderFingerprint({
    phone: "645290441",
    deliveryDate: "2026-05-01",
    items: [{ type: "box", flavor: "Lotus", qty: 1 }],
  })

  const differentQty = buildChatOrderFingerprint({
    phone: "645290441",
    deliveryDate: "2026-05-01",
    items: [{ type: "cake", flavor: "Lotus", qty: 2 }],
  })

  assert.notEqual(base, differentFlavor)
  assert.notEqual(base, differentSize)
  assert.notEqual(base, differentQty)
})

test("acumula varias tartas iguales dentro del mismo pedido incrementando la cantidad", () => {
  const merged = appendOrderItem([{ type: "cake", flavor: "Lotus", qty: 1 }], { type: "cake", flavor: "lotus", qty: 1 })

  assert.deepEqual(merged, [{ type: "cake", flavor: "Lotus", qty: 2 }])
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
