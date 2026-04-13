import test from "node:test"
import assert from "node:assert/strict"

import { getContactLauncherMode } from "../src/components/contact-launcher"
import { MOBILE_LAUNCHER_WHATSAPP_LINK } from "../src/data/business"

test("en mobile web el launcher principal es WhatsApp", () => {
  assert.equal(getContactLauncherMode(true), "whatsapp")
  assert.equal(MOBILE_LAUNCHER_WHATSAPP_LINK, "https://wa.me/16414294476")
})

test("en desktop se mantiene el chat web como launcher principal", () => {
  assert.equal(getContactLauncherMode(false), "chat")
})
