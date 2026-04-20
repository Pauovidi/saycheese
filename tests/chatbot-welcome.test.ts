import test from "node:test"
import assert from "node:assert/strict"

import { hasGreetingIntent, WELCOME_MESSAGE } from "../lib/chatbot/welcome"

test("mantiene exactamente el saludo histórico del chatbot", () => {
  assert.equal(
    WELCOME_MESSAGE,
    `¡Hola! Siempre trabajamos con 2 tamaños: grande, con un precio de 35 € y cajita, con un precio de 12 €.

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

test("reconoce el saludo simple para devolver el mensaje histórico", () => {
  assert.equal(hasGreetingIntent("hola"), true)
  assert.equal(hasGreetingIntent("buenas"), true)
  assert.equal(hasGreetingIntent("quiero una tarta"), false)
})
