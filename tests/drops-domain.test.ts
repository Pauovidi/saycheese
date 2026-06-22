import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_DROP_LAUNCH_AT_UTC,
  computeAvailableDropStock,
  getDropPublicStatus,
  localDateTimeToUtcIso,
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
})

test("Atlantic/Canary 01/07/2026 00:00 se almacena como UTC consistente", () => {
  assert.equal(localDateTimeToUtcIso("2026-07-01T00:00", "Atlantic/Canary"), DEFAULT_DROP_LAUNCH_AT_UTC)
  assert.equal(utcIsoToDateTimeLocalInZone(DEFAULT_DROP_LAUNCH_AT_UTC, "Atlantic/Canary"), "2026-07-01T00:00")
})

test("stock disponible descuenta preventas activas y pedidos", () => {
  assert.equal(
    computeAvailableDropStock({
      stockTotal: 30,
      reservedUnits: 2,
      orderedUnits: 2,
    }),
    26
  )
})

test("normaliza tallas y colores configurables sin duplicados", () => {
  assert.deepEqual(parseDropOptionList("S\nM\nm\nL, XL "), ["S", "M", "L", "XL"])
})
