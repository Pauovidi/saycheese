import assert from "node:assert/strict"
import test from "node:test"

import {
  earliestPickupDateISO,
  formatDateEs,
  parseSpanishDesiredDate,
  resolveRequestedPickupDate,
} from "../lib/chatbot/date-rules"

const NOW = new Date("2026-03-12T10:00:00Z")
const APRIL_2026_NOW = new Date("2026-04-27T10:00:00Z")
const SHOP_TZ = "Europe/Madrid"
const LEAD_DAYS = 3

test("interpreta fecha parcial con solo día numérico", () => {
  const parsed = parseSpanishDesiredDate("para el 18 puede ser?", NOW, SHOP_TZ)
  assert.deepEqual(parsed, { kind: "date", iso: "2026-03-18" })
})

test("interpreta fecha con día y mes en texto", () => {
  const parsed = parseSpanishDesiredDate("el 18 de marzo", NOW, SHOP_TZ)
  assert.deepEqual(parsed, { kind: "date", iso: "2026-03-18" })
})

test("interpreta fecha numérica completa", () => {
  const parsed = parseSpanishDesiredDate("16/03", NOW, SHOP_TZ)
  assert.deepEqual(parsed, { kind: "date", iso: "2026-03-16" })
})

test("resuelve próximo día de semana válido", () => {
  const parsed = parseSpanishDesiredDate("miércoles", NOW, SHOP_TZ)
  assert.deepEqual(parsed, { kind: "date", iso: "2026-03-18" })
})

test("rechaza martes por día cerrado y propone miércoles", () => {
  const resolution = resolveRequestedPickupDate("2026-03-17", NOW, LEAD_DAYS, SHOP_TZ)
  assert.deepEqual(resolution, {
    kind: "closed",
    requestedDate: "2026-03-17",
    nextAvailableDate: "2026-03-18",
  })
})

test("rechaza lunes por día cerrado y salta al siguiente día abierto", () => {
  const resolution = resolveRequestedPickupDate("2026-03-16", NOW, LEAD_DAYS, SHOP_TZ)
  assert.deepEqual(resolution, {
    kind: "closed",
    requestedDate: "2026-03-16",
    nextAvailableDate: "2026-03-18",
  })
})

test("rechaza fechas con menos de 3 días y devuelve la primera disponible abierta", () => {
  const resolution = resolveRequestedPickupDate("2026-03-14", NOW, LEAD_DAYS, SHOP_TZ)
  assert.deepEqual(resolution, {
    kind: "too_soon",
    requestedDate: "2026-03-14",
    earliestDate: "2026-03-15",
  })
})

test("acepta miércoles válido cuando cumple plazo y apertura", () => {
  const resolution = resolveRequestedPickupDate("2026-03-18", NOW, LEAD_DAYS, SHOP_TZ)
  assert.deepEqual(resolution, {
    kind: "valid",
    requestedDate: "2026-03-18",
    pickupDate: "2026-03-18",
  })
})

test("la primera fecha disponible ya respeta días abiertos", () => {
  assert.equal(earliestPickupDateISO(NOW, LEAD_DAYS, SHOP_TZ), "2026-03-15")
})

test("interpreta jueves 30/04 con el año actual de la fecha base", () => {
  const parsed = parseSpanishDesiredDate("jueves 30/04", APRIL_2026_NOW, SHOP_TZ)

  assert.deepEqual(parsed, { kind: "date", iso: "2026-04-30" })
  assert.equal(formatDateEs("2026-04-30", SHOP_TZ), "jueves 30/04")
})

test("interpreta fecha numérica sin año con el año actual, no con un año anterior", () => {
  const parsed = parseSpanishDesiredDate("30/04", APRIL_2026_NOW, SHOP_TZ)

  assert.deepEqual(parsed, { kind: "date", iso: "2026-04-30" })
})

test("acepta jueves 30/04 cuando cumple plazo y no lo trata como martes cerrado", () => {
  const parsed = parseSpanishDesiredDate("jueves 30/04", APRIL_2026_NOW, SHOP_TZ)
  assert.deepEqual(parsed, { kind: "date", iso: "2026-04-30" })

  const resolution = resolveRequestedPickupDate(parsed.iso, APRIL_2026_NOW, LEAD_DAYS, SHOP_TZ)
  assert.deepEqual(resolution, {
    kind: "valid",
    requestedDate: "2026-04-30",
    pickupDate: "2026-04-30",
  })
})

test("la primera fecha disponible no salta si 30/04 ya es válido", () => {
  assert.equal(earliestPickupDateISO(APRIL_2026_NOW, LEAD_DAYS, SHOP_TZ), "2026-04-30")
})

test("pide confirmación si el día de semana escrito no coincide con la fecha numérica", () => {
  const parsed = parseSpanishDesiredDate("martes 30/04", APRIL_2026_NOW, SHOP_TZ)

  assert.equal(parsed?.kind, "ambiguous")
  assert.match(parsed?.question ?? "", /30\/04 cae jueves/)
  assert.match(parsed?.question ?? "", /no martes/)
})
