import test from "node:test"
import assert from "node:assert/strict"

import {
  extractCustomerName,
  extractPhoneFromText,
  getAdditionalCakeDecisionIntent,
  hasExplicitNewOrderIntent,
  hasMultipleCakeOrderIntent,
  hasRecentOrderGuard,
  parseOrderFormat,
} from "../lib/chatbot/order-intake"
import { findExplicitFlavorSelection, findProductBySlugOrFlavor } from "../lib/chatbot/products"

process.env.CATALOG_TEST_READONLY_SEED_FALLBACK = "1"

test("captura varios datos en una sola intervención", async () => {
  const message = "mango, grande. Pau. 645290441"

  assert.equal((await findProductBySlugOrFlavor(message))?.category, "mango-maracuya")
  assert.equal(parseOrderFormat(message), "tarta")
  assert.equal(extractCustomerName(message), "Pau")
  assert.equal(extractPhoneFromText(message), "645290441")
})

test("trata cajita y pequeña como formato y no como sabor", async () => {
  assert.equal(parseOrderFormat("cajita"), "cajita")
  assert.equal(parseOrderFormat("pequeña"), "cajita")
  assert.equal(await findProductBySlugOrFlavor("cajita"), undefined)
})

test("prioriza un sabor válido como sabor y no como nombre", async () => {
  assert.equal((await findExplicitFlavorSelection("Gofio"))?.category, "gofio")
  assert.equal(extractCustomerName("Gofio", { blockedNormalizedTerms: ["gofio"] }), undefined)
})

test("solo permite otro pedido reciente cuando la intención es explícita", () => {
  assert.equal(hasExplicitNewOrderIntent("nuevo pedido lotus cajita"), true)
  assert.equal(hasExplicitNewOrderIntent("quiero otro"), true)
  assert.equal(hasExplicitNewOrderIntent("lotus cajita"), false)
  assert.equal(
    hasRecentOrderGuard("2026-04-20T10:00:00.000Z", new Date("2026-04-20T10:20:00.000Z")),
    true
  )
})

test("detecta cuando el usuario quiere varias tartas en el mismo pedido", () => {
  assert.equal(hasMultipleCakeOrderIntent("quiero dos tartas para el viernes"), true)
  assert.equal(hasMultipleCakeOrderIntent("quiero varias cajitas"), true)
  assert.equal(hasMultipleCakeOrderIntent("quiero una tarta"), false)
})

test("distingue entre añadir otra tarta y cerrar el pedido", () => {
  assert.equal(getAdditionalCakeDecisionIntent("añadir otra"), "add")
  assert.equal(getAdditionalCakeDecisionIntent("otra tarta de lotus"), "add")
  assert.equal(getAdditionalCakeDecisionIntent("cerrar el pedido"), "close")
  assert.equal(getAdditionalCakeDecisionIntent("eso es todo"), "close")
})

test("trata 'ya está', 'vale', 'ok' y 'listo' como cierre cuando toca y no como nombre", () => {
  for (const message of ["ya está", "vale", "ok", "listo", "cerrar pedido"]) {
    assert.equal(getAdditionalCakeDecisionIntent(message), "close")
    assert.equal(extractCustomerName(message, { allowSegmentExtraction: false }), undefined)
  }
})

test("no acepta texto basura como nombre y deja espacio al recovery corto", () => {
  assert.equal(extractCustomerName("blabla", { allowSegmentExtraction: false }), undefined)
  assert.equal(extractCustomerName("asdf", { allowSegmentExtraction: false }), undefined)
  assert.equal(extractCustomerName("zzzz", { allowSegmentExtraction: false }), undefined)
})
