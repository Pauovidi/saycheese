import test from "node:test"
import assert from "node:assert/strict"

import { isWhatsappConversationResetCommand } from "../lib/chatbot/commands"
import {
  HUMAN_SUPPORT_PHONE_DISPLAY,
  buildHumanSupportMessage,
  buildUnconfirmedProductInfoMessage,
} from "../src/data/business"

test("acepta 'reiniciar' como comando de reset en WhatsApp", () => {
  assert.equal(isWhatsappConversationResetCommand("whatsapp", "reiniciar"), true)
})

test("acepta 'reset' como comando de reset en WhatsApp", () => {
  assert.equal(isWhatsappConversationResetCommand("whatsapp", "reset"), true)
})

test("acepta 'empezar de nuevo' como comando de reset en WhatsApp", () => {
  assert.equal(isWhatsappConversationResetCommand("whatsapp", "empezar de nuevo"), true)
})

test("el handoff en WhatsApp no incluye wa.me", () => {
  const handoff = buildHumanSupportMessage("Te atiende una persona del equipo aquí:", "whatsapp")

  assert.match(handoff, /\+34 681 14 71 49/)
  assert.equal(handoff.includes("wa.me"), false)
  assert.equal(handoff.includes(HUMAN_SUPPORT_PHONE_DISPLAY), true)
})

test("el fallback informativo en WhatsApp tampoco incluye wa.me", () => {
  const fallback = buildUnconfirmedProductInfoMessage("whatsapp")

  assert.match(fallback, /\+34 681 14 71 49/)
  assert.equal(fallback.includes("wa.me"), false)
})
