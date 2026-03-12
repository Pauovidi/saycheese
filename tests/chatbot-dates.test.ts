import assert from "node:assert/strict"
import test from "node:test"

import {
  earliestPickupDateISO,
  parseSpanishDesiredDate,
  resolveRequestedPickupDate,
} from "../lib/chatbot/date-rules"

const NOW = new Date("2026-03-12T10:00:00Z")
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
