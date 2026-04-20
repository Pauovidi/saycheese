import test from "node:test"
import assert from "node:assert/strict"

import {
  dedupeAdminSearchOrders,
  escapeOrderSearchLikeValue,
  isOrderSearchQueryValid,
  normalizeOrderSearchPhone,
  normalizeOrderSearchText,
} from "../lib/admin/order-search"

test("acepta búsquedas por nombre aunque no haya teléfono", () => {
  assert.equal(isOrderSearchQueryValid("Laura"), true)
  assert.equal(isOrderSearchQueryValid("Pi"), true)
})

test("acepta búsquedas por teléfono con 6 o más dígitos", () => {
  assert.equal(isOrderSearchQueryValid("699 12 34 56"), true)
  assert.equal(normalizeOrderSearchPhone("+34 699 12 34 56"), "34699123456")
})

test("rechaza búsquedas demasiado cortas o vacías", () => {
  assert.equal(isOrderSearchQueryValid("A"), false)
  assert.equal(isOrderSearchQueryValid("12345"), false)
  assert.equal(normalizeOrderSearchText("  Ana   María "), "Ana María")
  assert.equal(escapeOrderSearchLikeValue("Lotus_%"), "Lotus")
})

test("deduplica resultados del buscador y deja primero el más reciente", () => {
  const deduped = dedupeAdminSearchOrders([
    { id: "1", created_at: "2026-04-20T10:00:00.000Z" },
    { id: "2", created_at: "2026-04-20T12:00:00.000Z" },
    { id: "1", created_at: "2026-04-20T10:00:00.000Z" },
  ])

  assert.deepEqual(
    deduped.map((order) => order.id),
    ["2", "1"]
  )
})
