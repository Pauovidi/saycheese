import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  buildHumanSupportPhoneMessage,
  buildHumanSupportPhoneReplyIfIntent,
  hasHumanSupportPhoneIntent,
} from "../lib/chatbot/contact"
import {
  HUMAN_SUPPORT_PHONE_DISPLAY,
  OFFICIAL_WHATSAPP_PHONE_DISPLAY,
} from "../src/data/business"

const contactMessages = [
  "Qué número puedo llamar?",
  "¿Cuál es vuestro teléfono?",
  "Dame el número de contacto",
  "¿A qué teléfono puedo llamar?",
  "¿Puedo llamaros?",
  "Quiero hablar por teléfono",
]

test("responde consultas de teléfono con el contacto humano central", () => {
  for (const message of contactMessages) {
    const reply = buildHumanSupportPhoneReplyIfIntent(message)

    assert.equal(hasHumanSupportPhoneIntent(message), true, message)
    assert.equal(reply, buildHumanSupportPhoneMessage(), message)
    assert.match(reply, new RegExp(HUMAN_SUPPORT_PHONE_DISPLAY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), message)
    assert.doesNotMatch(reply, /640\s*265\s*572/, message)
    assert.doesNotMatch(
      reply,
      new RegExp(OFFICIAL_WHATSAPP_PHONE_DISPLAY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      message
    )
  }
})

test("no confunde el teléfono del cliente o un número de pedido con el contacto", () => {
  const customerMessages = [
    "Mi teléfono es +34 640 265 572",
    "El número de mi pedido es 1234",
    "Quiero cambiar el teléfono del pedido",
  ]

  for (const message of customerMessages) {
    assert.equal(hasHumanSupportPhoneIntent(message), false, message)
    assert.equal(buildHumanSupportPhoneReplyIfIntent(message), null, message)
  }
})

test("el intent de contacto se resuelve antes de delegar la respuesta al modelo", () => {
  const engine = readFileSync(new URL("../lib/chatbot/engine.ts", import.meta.url), "utf8")
  const deterministicReply = engine.indexOf("const contactPhoneReply = buildHumanSupportPhoneReplyIfIntent(message)")
  const modelCall = engine.indexOf("const openai = getOpenAIClient()", deterministicReply)

  assert.ok(deterministicReply >= 0)
  assert.ok(modelCall > deterministicReply)
  assert.match(engine, /Nunca presentes el teléfono del cliente como teléfono del negocio/)
})
