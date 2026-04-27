import test from "node:test"
import assert from "node:assert/strict"

import {
  buildFlavorListMessage,
  type ChatbotAvailableCakeFlavor,
} from "../lib/chatbot/products"
import { hasGreetingIntent, WELCOME_MESSAGE } from "../lib/chatbot/welcome"

const catalogABC: ChatbotAvailableCakeFlavor[] = [
  {
    flavor: "A",
    sizes: [
      { format: "tarta", label: "grande", priceText: "35 €" },
      { format: "cajita", label: "cajita", priceText: "12 €" },
    ],
  },
  {
    flavor: "B",
    sizes: [
      { format: "tarta", label: "grande", priceText: "36 €" },
      { format: "cajita", label: "cajita", priceText: "13 €" },
    ],
  },
  {
    flavor: "C",
    sizes: [
      { format: "tarta", label: "grande", priceText: "37 €" },
      { format: "cajita", label: "cajita", priceText: "14 €" },
    ],
  },
]

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

test("lista los sabores publicados del catálogo recibido", () => {
  const message = buildFlavorListMessage(catalogABC, { includeGreeting: true, channel: "web", leadDays: 4 })

  assert.match(message, /A: grande 35 €, cajita 12 €/)
  assert.match(message, /B: grande 36 €, cajita 13 €/)
  assert.match(message, /C: grande 37 €, cajita 14 €/)
  assert.match(message, /Plazo mínimo 4 días/)
})

test("si se elimina o desactiva un sabor, deja de aparecer sin tocar el bot", () => {
  const withoutB = catalogABC.filter((flavor) => flavor.flavor !== "B")
  const message = buildFlavorListMessage(withoutB)

  assert.match(message, /A: grande 35 €, cajita 12 €/)
  assert.doesNotMatch(message, /\bB:/)
  assert.match(message, /C: grande 37 €, cajita 14 €/)
})

test("si se añade un sabor nuevo, aparece desde el catálogo sin tocar el bot", () => {
  const withD: ChatbotAvailableCakeFlavor[] = [
    ...catalogABC,
    {
      flavor: "D",
      sizes: [
        { format: "tarta", label: "grande", priceText: "38 €" },
        { format: "cajita", label: "cajita", priceText: "15 €" },
      ],
    },
  ]
  const message = buildFlavorListMessage(withD)

  assert.match(message, /D: grande 38 €, cajita 15 €/)
})

test("el mismo builder sirve para web y WhatsApp", () => {
  const webMessage = buildFlavorListMessage(catalogABC, { channel: "web" })
  const whatsappMessage = buildFlavorListMessage(catalogABC, { channel: "whatsapp" })

  assert.match(webMessage, /A: grande 35 €, cajita 12 €/)
  assert.match(whatsappMessage, /A: grande 35 €, cajita 12 €/)
  assert.equal(webMessage.replace(/^🍰 /, ""), whatsappMessage.replace(/^🍰 /, ""))
})

test("si no hay sabores publicados, ofrece contacto humano", () => {
  const message = buildFlavorListMessage([], { channel: "whatsapp" })

  assert.match(message, /no hay sabores publicados/)
  assert.match(message, /\+34 681 14 71 49/)
})

test("puede responder sabores sin repetir hola en mitad del flujo", () => {
  assert.equal(buildFlavorListMessage(catalogABC, { includeGreeting: false }).startsWith("¡Hola!"), false)
  assert.equal(buildFlavorListMessage(catalogABC, { includeGreeting: true }).startsWith("¡Hola!"), true)
})
