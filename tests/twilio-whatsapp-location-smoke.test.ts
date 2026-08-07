import test from "node:test"
import assert from "node:assert/strict"

import { buildStoreLocationMessage } from "../lib/chatbot/location"
import { handleTwilioWhatsappPost } from "../lib/twilio/whatsapp-webhook"
import { STORE_ADDRESS } from "../src/data/business"

function buildTwilioRequest(body: string) {
  const form = new URLSearchParams()
  form.set("Body", body)
  form.set("From", "whatsapp:+34600000000")

  return new Request("http://localhost/api/twilio/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  })
}

function buildTwilioRequestWithSid(body: string, messageSid: string) {
  const form = new URLSearchParams()
  form.set("Body", body)
  form.set("From", "whatsapp:+34600000000")
  form.set("MessageSid", messageSid)

  return new Request("http://localhost/api/twilio/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  })
}

test("smoke Twilio POST ubicación devuelve TwiML con dirección oficial", async () => {
  for (const message of ["Dónde está la tienda?", "donde estais?"]) {
    const response = await handleTwilioWhatsappPost(buildTwilioRequest(message), async (input) => {
      assert.equal(input.channel, "whatsapp")
      assert.equal(input.sessionId, "+34600000000")
      assert.equal(input.message, message)
      return { text: buildStoreLocationMessage() }
    })
    const xml = await response.text()

    assert.equal(response.status, 200)
    assert.match(response.headers.get("Content-Type") ?? "", /text\/xml/)
    assert.match(xml, /<Response><Message>/)
    assert.match(xml, new RegExp(STORE_ADDRESS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    assert.doesNotMatch(xml, /Madrid|Arapiles|\+1 641 429 4476/i)
  }
})

test("un MessageSid ya procesado no vuelve a ejecutar el bot ni responde", async () => {
  let handlerCalls = 0
  const response = await handleTwilioWhatsappPost(
    buildTwilioRequestWithSid("Disculpa por las molestias", "SM-duplicado"),
    async () => {
      handlerCalls += 1
      return { text: "No debería enviarse" }
    },
    { claimMessageSid: async () => false }
  )

  assert.equal(handlerCalls, 0)
  assert.equal(await response.text(), '<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
})
