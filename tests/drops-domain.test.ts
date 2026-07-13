import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_DROP_LAUNCH_AT_UTC,
  DEFAULT_DROP_PREORDER_CTA_TEXT,
  computeAvailableDropStock,
  computePreorderRemaining,
  buildDropSizeStockNumbers,
  computeDropSizeSellableNow,
  getDropPublicStatus,
  localDateTimeToUtcIso,
  normalizeDropPreorderCtaText,
  parseDropOptionList,
  utcIsoToDateTimeLocalInZone,
} from "../src/data/drops"

const launchAt = DEFAULT_DROP_LAUNCH_AT_UTC

test("estado temporal: antes del 1 de julio en Atlantic/Canary es PRELAUNCH", () => {
  assert.equal(
    getDropPublicStatus(
      {
        isActive: true,
        launchAt,
        availableStock: 30,
      },
      new Date("2026-06-30T22:59:59.999Z")
    ),
    "PRELAUNCH"
  )
})

test("estado temporal: exactamente en launchAt pasa a LIVE", () => {
  assert.equal(
    getDropPublicStatus(
      {
        isActive: true,
        launchAt,
        availableStock: 30,
      },
      new Date("2026-06-30T23:00:00.000Z")
    ),
    "LIVE"
  )
})

test("estado temporal: después de launchAt sigue LIVE", () => {
  assert.equal(
    getDropPublicStatus(
      {
        isActive: true,
        launchAt,
        availableStock: 30,
      },
      new Date("2026-07-01T10:00:00.000Z")
    ),
    "LIVE"
  )
})

test("estado público distingue inactivo, agotado y cerrado", () => {
  assert.equal(getDropPublicStatus({ isActive: false, launchAt, availableStock: 30 }), "INACTIVE")
  assert.equal(getDropPublicStatus({ isActive: true, launchAt, availableStock: 0 }), "SOLD_OUT")
  assert.equal(getDropPublicStatus({ isActive: true, isClosed: true, launchAt, availableStock: 30 }), "CLOSED")
  assert.equal(getDropPublicStatus({ isActive: true, archivedAt: "2026-06-27T10:00:00.000Z", launchAt, availableStock: 30 }), "CLOSED")
})

test("Atlantic/Canary 01/07/2026 00:00 se almacena como UTC consistente", () => {
  assert.equal(localDateTimeToUtcIso("2026-07-01T00:00", "Atlantic/Canary"), DEFAULT_DROP_LAUNCH_AT_UTC)
  assert.equal(utcIsoToDateTimeLocalInZone(DEFAULT_DROP_LAUNCH_AT_UTC, "Atlantic/Canary"), "2026-07-01T00:00")
})

test("stock disponible ignora preventas bajo pedido y descuenta solo pedidos live", () => {
  assert.equal(
    computeAvailableDropStock({
      stockTotal: 30,
      reservedUnits: 2,
      orderedUnits: 2,
    }),
    28
  )
})

test("cupo de preventa descuenta reservas activas sin depender de tallas o stock live", () => {
  assert.equal(computePreorderRemaining(30, 0), 30)
  assert.equal(computePreorderRemaining(30, 12), 18)
  assert.equal(computePreorderRemaining(30, 30), 0)
  assert.equal(computePreorderRemaining(30, 31), 0)
})

test("la preventa sigue disponible aunque el stock de venta normal sea cero", () => {
  assert.equal(
    getDropPublicStatus(
      { isActive: true, launchAt, availableStock: 0 },
      new Date("2026-06-30T22:59:59.999Z")
    ),
    "PRELAUNCH"
  )
})

test("stock por talla queda limitado por stock bruto y global disponible", () => {
  assert.equal(computeDropSizeSellableNow({ sizeStockTotal: 10, orderedUnitsBySize: 0, globalAvailable: 23 }), 10)
  assert.equal(computeDropSizeSellableNow({ sizeStockTotal: 10, orderedUnitsBySize: 0, globalAvailable: 2 }), 2)
  assert.equal(computeDropSizeSellableNow({ sizeStockTotal: 10, orderedUnitsBySize: 10, globalAvailable: 23 }), 0)

  assert.deepEqual(
    buildDropSizeStockNumbers({
      sizes: ["S", "M", "L", "XL"],
      sizeStockTotals: [
        { size: "S", stockTotal: 5, position: 0 },
        { size: "M", stockTotal: 10, position: 1 },
        { size: "L", stockTotal: 10, position: 2 },
        { size: "XL", stockTotal: 5, position: 3 },
      ],
      orderedUnitsBySize: { m: 3 },
      globalAvailable: 23,
    }).map((entry) => [entry.size, entry.availableRaw, entry.sellableNow]),
    [["S", 5, 5], ["M", 7, 7], ["L", 10, 10], ["XL", 5, 5]]
  )
})

test("normaliza tallas y colores configurables sin duplicados", () => {
  assert.deepEqual(parseDropOptionList("S\nM\nm\nL, XL "), ["S", "M", "L", "XL"])
})

test("CTA de preventa usa fallback y trim seguro", () => {
  assert.equal(normalizeDropPreorderCtaText(undefined), DEFAULT_DROP_PREORDER_CTA_TEXT)
  assert.equal(normalizeDropPreorderCtaText("  QUIERO LA MÍA  "), "QUIERO LA MÍA")
  assert.equal(normalizeDropPreorderCtaText("   "), DEFAULT_DROP_PREORDER_CTA_TEXT)
})
