import test from "node:test"
import assert from "node:assert/strict"

import { hasGreetingIntent, WELCOME_MESSAGE } from "../lib/chatbot/welcome"

test("mantiene exactamente el saludo histórico del chatbot", () => {
  assert.equal(
    WELCOME_MESSAGE,
    "¡Hola! Puedes reservar tu tarta para una fecha concreta y, además, normalmente también hay tartas en tienda para compra directa hasta agotar existencias. Si quieres, te ayudo con sabores, tamaños, precios o con una reserva."
  )
})

test("reconoce el saludo simple para devolver el mensaje histórico", () => {
  assert.equal(hasGreetingIntent("hola"), true)
  assert.equal(hasGreetingIntent("buenas"), true)
  assert.equal(hasGreetingIntent("quiero una tarta"), false)
})
