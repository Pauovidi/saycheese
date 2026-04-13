import test from "node:test"
import assert from "node:assert/strict"

import {
  buildHumanSupportMessage,
  HUMAN_SUPPORT_CONTACT,
  HUMAN_SUPPORT_PHONE_DISPLAY,
  HUMAN_SUPPORT_PHONE_E164,
  HUMAN_SUPPORT_PHONE_RAW,
  HUMAN_SUPPORT_WHATSAPP_LINK,
  WHATSAPP_SUPPORT_CONTACT,
  WHATSAPP_SUPPORT_PHONE_DISPLAY,
  WHATSAPP_SUPPORT_PHONE_E164,
  WHATSAPP_SUPPORT_PHONE_RAW,
} from "@/src/data/business"
import { resolveSupportLauncherVariant } from "@/src/lib/support-launcher"

test("centraliza por separado el telefono humano y el destino real de WhatsApp", () => {
  assert.equal(HUMAN_SUPPORT_CONTACT.raw, HUMAN_SUPPORT_PHONE_RAW)
  assert.equal(HUMAN_SUPPORT_CONTACT.display, HUMAN_SUPPORT_PHONE_DISPLAY)
  assert.equal(HUMAN_SUPPORT_CONTACT.e164, HUMAN_SUPPORT_PHONE_E164)
  assert.equal(WHATSAPP_SUPPORT_CONTACT.raw, WHATSAPP_SUPPORT_PHONE_RAW)
  assert.equal(WHATSAPP_SUPPORT_CONTACT.display, WHATSAPP_SUPPORT_PHONE_DISPLAY)
  assert.equal(WHATSAPP_SUPPORT_CONTACT.e164, WHATSAPP_SUPPORT_PHONE_E164)
  assert.equal(WHATSAPP_SUPPORT_CONTACT.whatsappHref, HUMAN_SUPPORT_WHATSAPP_LINK)
  assert.equal(HUMAN_SUPPORT_PHONE_DISPLAY, "+34 681 14 71 49")
  assert.equal(HUMAN_SUPPORT_PHONE_E164, "+34681147149")
  assert.equal(WHATSAPP_SUPPORT_PHONE_RAW, "6414294476")
  assert.equal(WHATSAPP_SUPPORT_PHONE_DISPLAY, "+1 641 429 4476")
  assert.equal(WHATSAPP_SUPPORT_PHONE_E164, "+16414294476")
  assert.equal(HUMAN_SUPPORT_WHATSAPP_LINK, "https://wa.me/16414294476")
})

test("el copy de handoff usa el telefono humano y no el destino de WhatsApp", () => {
  assert.equal(
    buildHumanSupportMessage(),
    "Si lo prefieres, te atiende una persona en el +34 681 14 71 49."
  )
})

test("el launcher resuelve la variante correcta en movil y desktop", () => {
  assert.equal(resolveSupportLauncherVariant(false, false), "hidden")
  assert.equal(resolveSupportLauncherVariant(true, true), "mobile-whatsapp")
  assert.equal(resolveSupportLauncherVariant(true, false), "desktop-chat")
})
