import assert from "node:assert/strict"
import test from "node:test"

import { validateOrderPickupDate } from "../lib/pickup-date-validation"

const NOW = new Date("2026-03-12T10:00:00Z")
const SHOP_TZ = "Europe/Madrid"
const LEAD_DAYS = 3

test("sin fecha el pedido es inválido", () => {
  const validation = validateOrderPickupDate(undefined, NOW, LEAD_DAYS, SHOP_TZ)

  assert.deepEqual(validation, {
    kind: "missing",
    earliestDate: "2026-03-15",
  })
})

test("con menos de 3 días de antelación es inválido", () => {
  const validation = validateOrderPickupDate("2026-03-14", NOW, LEAD_DAYS, SHOP_TZ)

  assert.deepEqual(validation, {
    kind: "too_soon",
    requestedDate: "2026-03-14",
    earliestDate: "2026-03-15",
  })
})

test("en día de descanso es inválido", () => {
  const validation = validateOrderPickupDate("2026-03-17", NOW, LEAD_DAYS, SHOP_TZ)

  assert.deepEqual(validation, {
    kind: "closed",
    requestedDate: "2026-03-17",
    nextAvailableDate: "2026-03-18",
  })
})

test("una fecha válida es aceptada", () => {
  const validation = validateOrderPickupDate("2026-03-18", NOW, LEAD_DAYS, SHOP_TZ)

  assert.deepEqual(validation, {
    kind: "valid",
    requestedDate: "2026-03-18",
    pickupDate: "2026-03-18",
  })
})
