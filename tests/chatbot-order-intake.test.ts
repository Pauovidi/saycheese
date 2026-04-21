import test from "node:test"
import assert from "node:assert/strict"

import {
  extractCustomerName,
  extractPhoneFromText,
  hasAddAnotherCakeIntent,
  hasCloseOrderIntent,
  hasExplicitNewOrderIntent,
  hasMultipleCakeOrderIntent,
  hasRecentOrderGuard,
  parseOrderFormat,
} from "../lib/chatbot/order-intake"
import { findExplicitFlavorSelection, findProductBySlugOrFlavor } from "../lib/chatbot/products"

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
  assert.equal(hasAddAnotherCakeIntent("añadir otra"), true)
  assert.equal(hasAddAnotherCakeIntent("otra tarta de lotus"), true)
  assert.equal(hasCloseOrderIntent("cerrar el pedido"), true)
  assert.equal(hasCloseOrderIntent("eso es todo"), true)
})
