import test from "node:test"
import assert from "node:assert/strict"

import {
  buildFlavorsAndSizesMessage,
  FLAVORS_AND_SIZES_MESSAGE,
  hasGreetingIntent,
  WELCOME_MESSAGE,
} from "../lib/chatbot/welcome"

test("mantiene exactamente el saludo histórico del chatbot", () => {
  assert.equal(
    WELCOME_MESSAGE,
    "¡Hola! 👋 Puedes reservar tu tarta para una fecha concreta y, además, normalmente también hay tartas en tienda para compra directa hasta agotar existencias. Si quieres, te ayudo con sabores, tamaños, precios o con una reserva."
  )
})

test("reconoce el saludo simple para devolver el mensaje histórico", () => {
  assert.equal(hasGreetingIntent("hola"), true)
  assert.equal(hasGreetingIntent("buenas"), true)
  assert.equal(hasGreetingIntent("hola que sabores hay"), false)
  assert.equal(hasGreetingIntent("quiero una tarta"), false)
})

test("usa el copy simplificado para sabores y tamaños", () => {
  assert.equal(
    FLAVORS_AND_SIZES_MESSAGE,
    `¡Hola! 🍰 Siempre trabajamos con 2 tamaños: grande, con un precio de 35 € y cajita, con un precio de 12 €.

Sabores:
- Clásica
- Lotus
- Pistacho
- Gofio
- Mango-Maracuyá
- Hippo
- Dulce de Leche
- Nutella
- Tiramisú

Solo recogida en tienda. No hacemos envíos. Plazo mínimo 3 días.`
  )
})

test("puede responder sabores sin repetir hola en mitad del flujo", () => {
  assert.equal(buildFlavorsAndSizesMessage(false).startsWith("¡Hola!"), false)
  assert.equal(buildFlavorsAndSizesMessage(true), FLAVORS_AND_SIZES_MESSAGE)
})
