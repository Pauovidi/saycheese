import test from "node:test"
import assert from "node:assert/strict"

import {
  buildOrderSearchPhoneVariants,
  dedupeAdminSearchOrders,
  escapeOrderSearchLikeValue,
  hasOrderSearchLetters,
  isOrderSearchQueryValid,
  normalizeOrderSearchPhone,
  normalizeOrderSearchText,
  orderPhoneMatchesSearch,
} from "../lib/admin/order-search"

test("acepta búsquedas por nombre aunque no haya teléfono", () => {
  assert.equal(isOrderSearchQueryValid("Pau"), true)
  assert.equal(isOrderSearchQueryValid("Pi"), true)
})

test("genera variantes para teléfonos con y sin prefijo +34", () => {
  assert.equal(normalizeOrderSearchPhone("+34 645 29 04 41"), "34645290441")
  assert.deepEqual(buildOrderSearchPhoneVariants("+34 645 29 04 41"), ["645290441", "34645290441"])
  assert.deepEqual(buildOrderSearchPhoneVariants("645290441"), ["645290441", "34645290441"])
})

test("encuentra el mismo pedido por teléfono exacto, sin prefijo y parcial", () => {
  assert.equal(orderPhoneMatchesSearch("+34 645 29 04 41", "+34 645 29 04 41"), true)
  assert.equal(orderPhoneMatchesSearch("+34 645 29 04 41", "645290441"), true)
  assert.equal(orderPhoneMatchesSearch("+34 645 29 04 41", "290441"), true)
})

test("rechaza búsquedas demasiado cortas y distingue texto real", () => {
  assert.equal(isOrderSearchQueryValid("A"), false)
  assert.equal(isOrderSearchQueryValid("12345"), false)
  assert.equal(hasOrderSearchLetters("+34 645 29 04 41"), false)
  assert.equal(hasOrderSearchLetters("Pau"), true)
  assert.equal(normalizeOrderSearchText("  Pau   Ovidi "), "Pau Ovidi")
  assert.equal(escapeOrderSearchLikeValue("Lotus_%"), "Lotus")
})

test("deduplica resultados y deja primero el más reciente", () => {
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
