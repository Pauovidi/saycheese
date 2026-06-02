import test from "node:test"
import assert from "node:assert/strict"

import {
  buildStoreLocationMessage,
  buildStoreLocationReplyIfIntent,
  hasStoreLocationIntent,
  hasUnsafeStoreAddressClaim,
} from "../lib/chatbot/location"
import {
  buildFlavorListMessage,
  type ChatbotAvailableCakeFlavor,
} from "../lib/chatbot/products"
import {
  HUMAN_SUPPORT_PHONE_DISPLAY,
  OFFICIAL_WHATSAPP_PHONE_DISPLAY,
  STORE_ADDRESS,
} from "../src/data/business"

const locationMessages = [
  "Dónde está la tienda?",
  "donde estais?",
  "dónde estáis?",
  "ubicación",
  "dirección",
  "tenéis tienda física?",
  "obrador",
  "cómo llegar",
  "donde está la tienda",
  "dónde está la tienda",
  "donde queda la tienda",
  "ubicacion",
  "direccion",
  "teneis tienda fisica",
  "local",
  "tienda",
]

test("detecta ubicación antes de LLM/handoff y responde con la dirección centralizada", () => {
  for (const message of locationMessages) {
    const reply = buildStoreLocationReplyIfIntent(message)

    assert.equal(hasStoreLocationIntent(message), true, message)
    assert.ok(reply, message)
    assert.match(reply, new RegExp(STORE_ADDRESS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), message)
    assert.doesNotMatch(reply, /Madrid/i, message)
    assert.doesNotMatch(reply, /Arapiles/i, message)
    assert.doesNotMatch(reply, new RegExp(OFFICIAL_WHATSAPP_PHONE_DISPLAY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), message)
    assert.doesNotMatch(reply, new RegExp(HUMAN_SUPPORT_PHONE_DISPLAY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), message)
    assert.doesNotMatch(reply, /Te atiende una persona del equipo/i, message)
  }
})

test("si falta dirección configurada responde de forma segura", () => {
  assert.equal(
    buildStoreLocationMessage(" "),
    "Te confirmo la ubicación exacta con el equipo para no darte un dato incorrecto."
  )
})

test("marca claims de direcciones falsas conocidas como inseguros", () => {
  assert.equal(hasUnsafeStoreAddressClaim("Nuestra tienda Tentados está en Madrid, en la calle Arapiles 14."), true)
  assert.equal(hasUnsafeStoreAddressClaim(buildStoreLocationMessage()), false)
})

test("mantiene sabores/precios y tarta del mes fuera del intent de ubicación", () => {
  const catalog: ChatbotAvailableCakeFlavor[] = [
    {
      flavor: "Dubai pistacho",
      sizes: [
        { format: "tarta", label: "grande", priceText: "35 €" },
        { format: "cajita", label: "cajita", priceText: "12 €" },
      ],
      isMonthlySpecial: true,
      isMonthlySpecialActive: true,
    },
    {
      flavor: "Lotus",
      sizes: [
        { format: "tarta", label: "grande", priceText: "35 €" },
        { format: "cajita", label: "cajita", priceText: "12 €" },
      ],
    },
  ]
  const reply = buildFlavorListMessage(catalog, { channel: "whatsapp", leadDays: 3 })

  assert.equal(hasStoreLocationIntent("qué sabores y precios hay?"), false)
  assert.match(reply, /Tarta del mes: Dubai pistacho/)
  assert.match(reply, /Grande: 35 €/)
  assert.match(reply, /Cajita: 12 €/)
})
