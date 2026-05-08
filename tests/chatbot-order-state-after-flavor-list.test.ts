import test from "node:test"
import assert from "node:assert/strict"

import {
  buildPendingOrderItems,
  processOrderConversationTurn,
  type OrderState,
  type ProcessOrderConversationTurnInput,
} from "../lib/chatbot/order-flow"
import {
  buildFlavorListMessage,
  buildUnavailableFlavorMessage,
  isUnsafeChatbotCatalogName,
  resolveFlavorSelectionFromProducts,
  type ChatbotAvailableCakeFlavor,
} from "../lib/chatbot/products"
import type { Product } from "../src/data/products"

const NOW = new Date("2026-05-08T10:00:00+02:00")
const SHOP_TZ = "Europe/Madrid"
const LEAD_DAYS = 3

type TestDeps = NonNullable<ProcessOrderConversationTurnInput["deps"]>
type UnavailableFlavor = { category: string; flavor: string; status: string }

function product(category: string, name: string, format: "tarta" | "cajita", overrides: Partial<Product> = {}): Product {
  return {
    id: `${format}-${category}`,
    name,
    slug: `${format}-${category}`,
    format,
    category,
    priceText: format === "tarta" ? "35 €" : "12 €",
    priceValue: format === "tarta" ? 35 : 12,
    shortDescription: `${format} de ${name}`,
    fullDescription: `${format} de ${name}`,
    allergens: format === "tarta" ? "Leche, huevo, gluten" : undefined,
    images: [],
    featured: false,
    ...overrides,
  }
}

function flavor(category: string, name: string, overrides: Partial<Product> = {}) {
  return [
    product(category, name, "cajita", overrides),
    product(category, name, "tarta", overrides),
  ]
}

const catalogProducts: Product[] = [
  ...flavor("cacahuete-con-chocolate", "Cacahuete con chocolate"),
  ...flavor("lotus", "Lotus"),
  ...flavor("pistacho", "Pistacho"),
  ...flavor("chocolate-blanco", "Chocolate blanco"),
  ...flavor("chocolate-negro", "Chocolate negro"),
  ...flavor("dubai-pistacho", "Dubai pistacho", {
    isMonthlySpecial: true,
    isMonthlySpecialActive: true,
    monthlySpecialExpiresAt: "2999-05-31T21:59:00.000Z",
  }),
]

function flavorsForMessage(products: Product[]): ChatbotAvailableCakeFlavor[] {
  const grouped = new Map<string, ChatbotAvailableCakeFlavor>()

  for (const entry of products) {
    const current = grouped.get(entry.category) ?? {
      flavor: entry.name,
      sizes: [],
      isMonthlySpecial: entry.isMonthlySpecial,
      isMonthlySpecialActive: entry.isMonthlySpecialActive,
      monthlySpecialExpiresAt: entry.monthlySpecialExpiresAt,
    }

    current.sizes.push({
      format: entry.format,
      label: entry.format === "tarta" ? "grande" : "cajita",
      priceText: entry.priceText,
    })
    current.isMonthlySpecial = current.isMonthlySpecial || entry.isMonthlySpecial
    current.isMonthlySpecialActive = current.isMonthlySpecialActive || entry.isMonthlySpecialActive
    current.monthlySpecialExpiresAt = current.monthlySpecialExpiresAt ?? entry.monthlySpecialExpiresAt
    grouped.set(entry.category, current)
  }

  return Array.from(grouped.values())
}

function createDeps(products: Product[] = catalogProducts, unavailable: UnavailableFlavor[] = []): TestDeps {
  return {
    buildFlavorsReply: async (includeGreeting, channel) =>
      buildFlavorListMessage(flavorsForMessage(products), { includeGreeting, channel, leadDays: LEAD_DAYS }),
    buildUnavailableFlavorMessage: async (flavorName) => {
      const safeName = isUnsafeChatbotCatalogName(flavorName) ? "ese sabor" : flavorName
      return `Ahora mismo ${safeName} no está disponible para nuevos pedidos. Ahora mismo puedes pedir: ${flavorsForMessage(products)
        .slice(0, 3)
        .map((entry) => entry.flavor)
        .join(", ")}.`
    },
    findFlavorFactsByQuery: async (query) => {
      const selection = resolveFlavorSelectionFromProducts(query, products)
      const selected = selection.kind === "matched"
        ? selection.product
        : products.find((entry) => entry.category === query)
      if (!selected) return undefined

      return {
        category: selected.category,
        label: selected.name,
        allergens: selected.allergens ? selected.allergens.split(",").map((entry) => entry.trim()) : [],
        ingredients: [],
        sourceProduct: selected,
      }
    },
    findProductBySlugOrFlavor: async (query) => {
      const selection = resolveFlavorSelectionFromProducts(query, products)
      return selection.kind === "matched" ? selection.product : products.find((entry) => entry.category === query)
    },
    findUnavailableFlavorByQuery: async (query) => {
      const unavailableProducts = unavailable.flatMap((entry) => flavor(entry.category, entry.flavor))
      const selection = resolveFlavorSelectionFromProducts(query, unavailableProducts)
      if (selection.kind !== "matched") return undefined

      return unavailable.find((entry) => entry.category === selection.product.category)
    },
    resolveAvailableFlavorSelection: async (query) => resolveFlavorSelectionFromProducts(query, products),
  }
}

async function send(
  state: OrderState,
  message: string,
  deps = createDeps()
) {
  const result = await processOrderConversationTurn({
    message,
    channel: "web",
    state,
    now: NOW,
    isOpeningConversation: false,
    leadDays: LEAD_DAYS,
    shopTz: SHOP_TZ,
    deps,
  })

  assert.notEqual(result.kind, "unhandled", `turno no gestionado: ${message}`)
  return result
}

test("pedido -> sabores -> sabor parcial -> fecha -> cajita telefono pide solo nombre", async () => {
  const state: OrderState = {}

  await send(state, "Quiero hacer un pedido")
  assert.equal(state.inOrderFlow, true)

  const flavorsReply = await send(state, "¿Qué sabores y tamaños hay?")
  assert.equal(flavorsReply.kind, "reply")
  assert.match(flavorsReply.text, /Cacahuete con chocolate/)
  assert.equal(state.inOrderFlow, true)

  const flavorReply = await send(state, "cacahuete")
  assert.equal(flavorReply.kind, "reply")
  assert.equal(state.flavor, "cacahuete-con-chocolate")
  assert.match(flavorReply.text, /Para qué día/)

  await send(state, "miércoles")
  assert.equal(state.flavor, "cacahuete-con-chocolate")
  assert.equal(state.finalDate, "2026-05-13")

  const combinedReply = await send(state, "cajita. 645290441")
  assert.equal(combinedReply.kind, "reply")
  assert.equal(state.format, "cajita")
  assert.equal(state.phone, "645290441")
  assert.match(combinedReply.text, /me falta tu nombre/)
  assert.doesNotMatch(combinedReply.text, /tel[eé]fono|formato/)
})

test("fecha antes y sabor parcial después conserva la fecha del pedido activo", async () => {
  const state: OrderState = {}

  await send(state, "Quiero hacer un pedido")
  await send(state, "miércoles")
  assert.equal(state.finalDate, "2026-05-13")

  await send(state, "¿Qué sabores y tamaños hay?")
  const flavorReply = await send(state, "cacahuete")

  assert.equal(flavorReply.kind, "reply")
  assert.equal(state.finalDate, "2026-05-13")
  assert.equal(state.flavor, "cacahuete-con-chocolate")
  assert.match(flavorReply.text, /formato/)
})

test("detecta mensajes compuestos de formato y teléfono", async () => {
  for (const message of ["cajita. 645290441", "cajita 645290441", "grande 645290441"]) {
    const state: OrderState = {
      inOrderFlow: true,
      finalDate: "2026-05-13",
      flavor: "cacahuete-con-chocolate",
    }

    const reply = await send(state, message)
    assert.equal(reply.kind, "reply")
    assert.equal(state.phone, "645290441")
    assert.equal(state.format, message.startsWith("grande") ? "tarta" : "cajita")
    assert.match(reply.text, /me falta tu nombre/)
    assert.doesNotMatch(reply.text, /tel[eé]fono|formato/)
  }
})

test("no usa nunca Auditoría Temporal Codex como sabor ni como respuesta", async () => {
  const unsafeProducts = flavor("auditoria-temporal-codex", "Auditoría Temporal Codex")
  assert.equal(resolveFlavorSelectionFromProducts("auditoria", unsafeProducts).kind, "none")

  const previousFallback = process.env.CATALOG_TEST_READONLY_SEED_FALLBACK
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const previousServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.CATALOG_TEST_READONLY_SEED_FALLBACK = "1"
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    const message = await buildUnavailableFlavorMessage("Auditoría Temporal Codex", { channel: "web" })
    assert.doesNotMatch(message, /Auditor[ií]a Temporal Codex|Codex/)
  } finally {
    if (previousFallback === undefined) delete process.env.CATALOG_TEST_READONLY_SEED_FALLBACK
    else process.env.CATALOG_TEST_READONLY_SEED_FALLBACK = previousFallback
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
    if (previousServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRole
  }

  const state: OrderState = { inOrderFlow: true }
  const reply = await send(
    state,
    "Auditoría Temporal Codex",
    createDeps(catalogProducts, [{ category: "auditoria-temporal-codex", flavor: "Auditoría Temporal Codex", status: "despublicada" }])
  )
  assert.equal(reply.kind, "reply")
  assert.doesNotMatch(reply.text, /Auditor[ií]a Temporal Codex|Codex/)
})

test("un sabor parcial inequívoco se resuelve al nombre completo", () => {
  const selection = resolveFlavorSelectionFromProducts("cacahuete", catalogProducts)

  assert.equal(selection.kind, "matched")
  if (selection.kind === "matched") {
    assert.equal(selection.product.name, "Cacahuete con chocolate")
    assert.equal(selection.product.category, "cacahuete-con-chocolate")
  }
})

test("un sabor parcial ambiguo pide aclaración", async () => {
  const state: OrderState = { inOrderFlow: true }
  const reply = await send(state, "chocolate")

  assert.equal(reply.kind, "reply")
  assert.match(reply.text, /más de un sabor parecido/)
  assert.match(reply.text, /Cacahuete con chocolate/)
  assert.match(reply.text, /Chocolate blanco/)
})

test("listar sabores no resetea un pedido activo", async () => {
  const state: OrderState = {
    inOrderFlow: true,
    flavor: "lotus",
    finalDate: "2026-05-13",
    phone: "645290441",
  }

  const reply = await send(state, "¿Qué sabores y tamaños hay?")

  assert.equal(reply.kind, "reply")
  assert.equal(state.inOrderFlow, true)
  assert.equal(state.flavor, "lotus")
  assert.equal(state.finalDate, "2026-05-13")
  assert.equal(state.phone, "645290441")
})

test("multi-item mantiene el estado entre tartas", async () => {
  const state: OrderState = {}

  await send(state, "quiero dos tartas")
  await send(state, "miércoles")
  const firstItem = await send(state, "lotus grande. Pau. 645290441")

  assert.equal(firstItem.kind, "reply")
  assert.equal(buildPendingOrderItems(state).length, 1)
  assert.equal(state.awaitingAdditionalCakeDecision, true)
  assert.match(firstItem.text, /añadir otra tarta/)

  const secondItem = await send(state, "otra tarta de pistacho grande")

  assert.equal(secondItem.kind, "reply")
  assert.equal(buildPendingOrderItems(state).length, 2)
  assert.deepEqual(
    buildPendingOrderItems(state).map((item) => item.flavor),
    ["lotus", "pistacho"]
  )

  const close = await send(state, "cerrar pedido")
  assert.equal(close.kind, "finalize")
})

test("tarta del mes activa se puede pedir si está disponible", async () => {
  const state: OrderState = {}

  const reply = await send(state, "quiero una grande de dubai para miércoles. Pau. 645290441")

  assert.equal(reply.kind, "reply")
  assert.equal(buildPendingOrderItems(state).length, 1)
  assert.equal(buildPendingOrderItems(state)[0]?.flavor, "dubai-pistacho")
  assert.match(reply.text, /Dubai pistacho/)
})

test("tarta del mes expirada o despublicada se rechaza", async () => {
  const state: OrderState = {}
  const deps = createDeps(catalogProducts, [
    { category: "cereza-fugaz", flavor: "Cereza fugaz", status: "tarta del mes expirada" },
  ])

  const reply = await send(state, "quiero una grande de cereza fugaz para miércoles", deps)

  assert.equal(reply.kind, "reply")
  assert.equal(state.flavor, undefined)
  assert.match(reply.text, /Cereza fugaz no está disponible/)
})
