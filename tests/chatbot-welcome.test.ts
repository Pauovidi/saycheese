import test from "node:test"
import assert from "node:assert/strict"

import {
  buildFlavorListMessage,
  type ChatbotAvailableCakeFlavor,
} from "../lib/chatbot/products"
import { hasGreetingIntent, WELCOME_MESSAGE } from "../lib/chatbot/welcome"

const catalogABC: ChatbotAvailableCakeFlavor[] = [
  {
    flavor: "Clásica",
    sizes: [
      { format: "tarta", label: "grande", priceText: "35 €" },
      { format: "cajita", label: "cajita", priceText: "12 €" },
    ],
  },
  {
    flavor: "Lotus",
    sizes: [
      { format: "tarta", label: "grande", priceText: "35 €" },
      { format: "cajita", label: "cajita", priceText: "12 €" },
    ],
  },
  {
    flavor: "Pistacho",
    sizes: [
      { format: "tarta", label: "grande", priceText: "35 €" },
      { format: "cajita", label: "cajita", priceText: "12 €" },
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

  assert.match(message, /Tenemos estos sabores disponibles:/)
  assert.match(message, /^- Clásica$/m)
  assert.match(message, /^- Lotus$/m)
  assert.match(message, /^- Pistacho$/m)
  assert.match(message, /Trabajamos con 2 tamaños:/)
  assert.match(message, /^- Grande: 35 €$/m)
  assert.match(message, /^- Cajita: 12 €$/m)
  assert.match(message, /Solo recogida en tienda\. No hacemos envíos\./)
  assert.match(message, /Plazo mínimo: 4 días\./)
})

test("si se elimina o desactiva un sabor, deja de aparecer sin tocar el bot", () => {
  const withoutB = catalogABC.filter((flavor) => flavor.flavor !== "Lotus")
  const message = buildFlavorListMessage(withoutB)

  assert.match(message, /^- Clásica$/m)
  assert.doesNotMatch(message, /^- Lotus$/m)
  assert.match(message, /^- Pistacho$/m)
})

test("si se añade un sabor nuevo, aparece desde el catálogo sin tocar el bot", () => {
  const withD: ChatbotAvailableCakeFlavor[] = [
    ...catalogABC,
    {
      flavor: "Oreo",
      sizes: [
        { format: "tarta", label: "grande", priceText: "35 €" },
        { format: "cajita", label: "cajita", priceText: "12 €" },
      ],
    },
  ]
  const message = buildFlavorListMessage(withD)

  assert.match(message, /^- Oreo$/m)
  assert.doesNotMatch(message, /Oreo: grande/)
})

test("el mismo builder sirve para web y WhatsApp", () => {
  const webMessage = buildFlavorListMessage(catalogABC, { channel: "web" })
  const whatsappMessage = buildFlavorListMessage(catalogABC, { channel: "whatsapp" })

  assert.match(webMessage, /^- Clásica$/m)
  assert.match(whatsappMessage, /^- Clásica$/m)
  assert.equal(webMessage.replace(/^🍰 /, ""), whatsappMessage.replace(/^🍰 /, ""))
})

test("no repite tamaños y precios por cada sabor", () => {
  const message = buildFlavorListMessage(catalogABC)

  assert.doesNotMatch(message, /Clásica: grande/)
  assert.doesNotMatch(message, /Lotus: grande/)
  assert.doesNotMatch(message, /: grande\s+35/)
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
