import test from "node:test"
import assert from "node:assert/strict"

import {
  HUMAN_SUPPORT_PHONE_E164,
  HUMAN_SUPPORT_WHATSAPP_LINK,
  MOBILE_LAUNCHER_WHATSAPP_PHONE_E164,
  MOBILE_LAUNCHER_WHATSAPP_LINK,
  STORE_ADDRESS,
  buildHumanSupportMessage,
} from "../src/data/business"
import { faqs } from "../src/data/faqs"

test("separa el WhatsApp oficial del bot del contacto humano", () => {
  assert.equal(MOBILE_LAUNCHER_WHATSAPP_PHONE_E164, "+16414294476")
  assert.equal(MOBILE_LAUNCHER_WHATSAPP_LINK, "https://wa.me/16414294476")
  assert.equal(HUMAN_SUPPORT_PHONE_E164, "+34681147149")
  assert.equal(HUMAN_SUPPORT_WHATSAPP_LINK, "https://wa.me/34681147149")
})

test("mantiene el copy de derivación humana apuntando al contacto central", () => {
  const message = buildHumanSupportMessage()

  assert.match(message, /https:\/\/wa\.me\/34681147149/)
  assert.doesNotMatch(message, /https:\/\/wa\.me\/16414294476/)
  assert.doesNotMatch(message, /\+1 641 429 4476/)
})

test("FAQ de pedidos no muestra el número antiguo ni WhatsApp directo incorrecto", () => {
  const ordersFaq = faqs.find((faq) => faq.question.includes("pedido"))
  const allFaqText = faqs.map((faq) => `${faq.question} ${faq.answer}`).join("\n")

  assert.ok(ordersFaq)
  assert.match(ordersFaq.answer, /web/)
  assert.match(ordersFaq.answer, /chatbot/)
  assert.doesNotMatch(allFaqText, /wa\.me\//)
  assert.doesNotMatch(ordersFaq.answer, /escribirnos directamente/i)
})

test("FAQ de tienda física muestra dirección y stock diario limitado", () => {
  const storeFaq = faqs.find((faq) => faq.question.includes("tienda física"))

  assert.ok(storeFaq)
  assert.match(storeFaq.answer, new RegExp(STORE_ADDRESS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.match(storeFaq.answer, /stock diario limitado/)
  assert.match(storeFaq.answer, /mini y medianas/)
})
