import test from "node:test"
import assert from "node:assert/strict"

import {
  processOrderConversationTurn,
  type OrderState,
  type ProcessOrderConversationTurnInput,
} from "../lib/chatbot/order-flow"
import { handleTwilioWhatsappPost } from "../lib/twilio/whatsapp-webhook"

const NOW = new Date("2026-06-03T10:00:00+02:00")
const SHOP_TZ = "Europe/Madrid"
const LEAD_DAYS = 3

const deps: NonNullable<ProcessOrderConversationTurnInput["deps"]> = {
  buildFlavorsReply: async () => "Sabores disponibles: clásica, pistacho.",
  buildUnavailableFlavorMessage: async (flavor) => `${flavor} no está disponible.`,
  findFlavorFactsByQuery: async () => undefined,
  findProductBySlugOrFlavor: async () => undefined,
  findUnavailableFlavorByQuery: async () => undefined,
  resolveAvailableFlavorSelection: async () => ({ kind: "none" }),
}

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

test("smoke Twilio fecha cerrada + propuesta + aceptación contextual", async () => {
  const states = new Map<string, OrderState>()

  async function reply(message: string) {
    const response = await handleTwilioWhatsappPost(buildTwilioRequest(message), async (input) => {
      const state = states.get(input.sessionId) ?? {}
      const result = await processOrderConversationTurn({
        message: input.message,
        channel: input.channel,
        state,
        now: NOW,
        isOpeningConversation: false,
        leadDays: LEAD_DAYS,
        shopTz: SHOP_TZ,
        phone: input.sessionId,
        deps,
      })

      states.set(input.sessionId, state)

      assert.notEqual(result.kind, "unhandled")
      if (result.kind !== "reply") return { text: "finalizado" }
      return { text: result.text }
    })

    assert.equal(response.status, 200)
    return response.text()
  }

  await reply("quiero una tarta")
  const proposalXml = await reply("martes")
  const acceptedXml = await reply("pues ese")

  assert.match(proposalXml, /miércoles 10\/06/)
  assert.match(acceptedXml, /miércoles 10\/06/)
  assert.match(acceptedXml, /sabor/)
  assert.doesNotMatch(acceptedXml, /Para qué día|Horario:|Miércoles: 16:30|Lunes y martes: cerrado/)
})
