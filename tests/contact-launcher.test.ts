import test from "node:test"
import assert from "node:assert/strict"

import {
  buildHumanSupportMessage,
  HUMAN_SUPPORT_CONTACT,
  HUMAN_SUPPORT_PHONE_DISPLAY,
  HUMAN_SUPPORT_PHONE_E164,
  HUMAN_SUPPORT_PHONE_RAW,
  HUMAN_SUPPORT_WHATSAPP_LINK,
} from "@/src/data/business"
import { resolveSupportLauncherVariant } from "@/src/lib/support-launcher"

test("centraliza el contacto humano y deriva formatos desde una sola fuente", () => {
  assert.equal(HUMAN_SUPPORT_CONTACT.raw, HUMAN_SUPPORT_PHONE_RAW)
  assert.equal(HUMAN_SUPPORT_CONTACT.display, HUMAN_SUPPORT_PHONE_DISPLAY)
  assert.equal(HUMAN_SUPPORT_CONTACT.e164, HUMAN_SUPPORT_PHONE_E164)
  assert.equal(HUMAN_SUPPORT_CONTACT.whatsappHref, HUMAN_SUPPORT_WHATSAPP_LINK)
  assert.equal(HUMAN_SUPPORT_PHONE_RAW, "6414294476")
  assert.equal(HUMAN_SUPPORT_PHONE_DISPLAY, "+1 641 429 4476")
  assert.equal(HUMAN_SUPPORT_PHONE_E164, "+16414294476")
  assert.equal(HUMAN_SUPPORT_WHATSAPP_LINK, "https://wa.me/16414294476")
})

test("el copy de handoff muestra el telefono legible y natural", () => {
  assert.equal(
    buildHumanSupportMessage(),
    "Si lo prefieres, te atiende una persona por WhatsApp en el +1 641 429 4476."
  )
})

test("el launcher resuelve la variante correcta en movil y desktop", () => {
  assert.equal(resolveSupportLauncherVariant(false, false), "hidden")
  assert.equal(resolveSupportLauncherVariant(true, true), "mobile-whatsapp")
  assert.equal(resolveSupportLauncherVariant(true, false), "desktop-chat")
})
