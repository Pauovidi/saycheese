import test from "node:test"
import assert from "node:assert/strict"

import {
  HUMAN_SUPPORT_PHONE_E164,
  HUMAN_SUPPORT_WHATSAPP_LINK,
  MOBILE_LAUNCHER_WHATSAPP_PHONE_E164,
  MOBILE_LAUNCHER_WHATSAPP_LINK,
  buildHumanSupportMessage,
} from "../src/data/business"

test("separa el launcher móvil del contacto humano del chat", () => {
  assert.equal(MOBILE_LAUNCHER_WHATSAPP_PHONE_E164, "+16414294476")
  assert.equal(MOBILE_LAUNCHER_WHATSAPP_LINK, "https://wa.me/16414294476")
  assert.equal(HUMAN_SUPPORT_PHONE_E164, "+34681147149")
  assert.equal(HUMAN_SUPPORT_WHATSAPP_LINK, "https://wa.me/34681147149")
})

test("mantiene el copy de derivación humana apuntando al contacto humano", () => {
  const message = buildHumanSupportMessage()

  assert.match(message, /https:\/\/wa\.me\/34681147149/)
  assert.match(message, /\+34681147149/)
  assert.doesNotMatch(message, /16414294476/)
})
