import assert from "node:assert/strict"
import test from "node:test"

import { buildDropsReplyIfIntent } from "../lib/chatbot/drops"
import { setDropStoreClientForTests } from "../src/data/drops-store"

type MockResponse = {
  data?: unknown
  error?: unknown
  count?: number | null
}

function createQueryBuilder(response: MockResponse) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    lte: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve(response),
    single: () => Promise.resolve(response),
    then: <TResult1 = MockResponse, TResult2 = never>(
      onfulfilled?: ((value: MockResponse) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise.resolve(response).then(onfulfilled, onrejected),
  }

  return builder
}

function setMockClient(input: { drops: MockResponse; stock?: MockResponse; sizeStock?: MockResponse }) {
  const client = {
    from: () => createQueryBuilder(input.drops),
    rpc: (name: string) =>
      createQueryBuilder(name === "get_drop_size_stock_summary" ? input.sizeStock ?? { data: [], error: null } : input.stock ?? { data: null, error: null }),
  }

  setDropStoreClientForTests(client as unknown as Parameters<typeof setDropStoreClientForTests>[0])
}

const dropRow = {
  id: "00000000-0000-0000-0000-000000000010",
  slug: "camiseta-tentados",
  name: "Camiseta Tentados",
  description: "Drop de prueba",
  price: 25,
  image_urls: ["/images/drop.jpg"],
  colors: ["Blanco", "Negro"],
  sizes: ["S", "M", "L", "XL"],
  stock_total: 30,
  size_stock_enabled: true,
  launch_at: "2026-06-30T23:00:00.000Z",
  launch_timezone: "Atlantic/Canary",
  is_active: true,
  floating_enabled: true,
  floating_message: "NUEVO DROP MUY PRONTO",
  preorder_cta_text: "Preventa",
  is_closed: false,
  archived_at: null,
  archived_by: null,
  archive_reason: null,
  created_at: null,
  updated_at: null,
}

const stockSummary = {
  stock_total: 30,
  reserved_units: 0,
  ordered_units: 0,
  available_stock: 30,
}

const sizeStockSummary = [
  { size: "S", stock_total: 5, ordered_units: 0, available_raw: 5, sellable_now: 5, position: 0 },
  { size: "M", stock_total: 10, ordered_units: 0, available_raw: 10, sellable_now: 10, position: 1 },
  { size: "L", stock_total: 10, ordered_units: 0, available_raw: 10, sellable_now: 10, position: 2 },
  { size: "XL", stock_total: 5, ordered_units: 0, available_raw: 5, sellable_now: 5, position: 3 },
]

const noSizeDropRow = {
  ...dropRow,
  slug: "poster-tentados",
  name: "Poster Tentados",
  sizes: [],
  stock_total: 12,
  size_stock_enabled: false,
}

test.afterEach(() => {
  setDropStoreClientForTests(null)
})

test("chatbot responde drops en preventa con fecha, precio, stock global, tallas y colores", async () => {
  setMockClient({ drops: { data: [dropRow], error: null }, stock: { data: stockSummary, error: null }, sizeStock: { data: sizeStockSummary, error: null } })

  const reply = await buildDropsReplyIfIntent("¿tenéis drops?")

  assert.match(reply ?? "", /Camiseta Tentados/)
  assert.match(reply ?? "", /preventa/i)
  assert.match(reply ?? "", /30 unidades/)
  assert.match(reply ?? "", /25/)
  assert.match(reply ?? "", /S, M, L, XL/)
  assert.match(reply ?? "", /Blanco, Negro/)
  assert.match(reply ?? "", /unidad genérica|unidad; talla/i)
})

test("chatbot responde disponibilidad real de talla concreta en LIVE", async () => {
  setMockClient({
    drops: { data: [{ ...dropRow, launch_at: "2026-01-01T00:00:00.000Z" }], error: null },
    stock: { data: stockSummary, error: null },
    sizeStock: { data: sizeStockSummary, error: null },
  })

  const reply = await buildDropsReplyIfIntent("¿queda talla M?")

  assert.match(reply ?? "", /talla M/i)
  assert.match(reply ?? "", /10 unidades vendibles/)
})

test("chatbot no crea pedidos de camisetas por WhatsApp", async () => {
  setMockClient({
    drops: { data: [{ ...dropRow, launch_at: "2026-01-01T00:00:00.000Z" }], error: null },
    stock: { data: stockSummary, error: null },
    sizeStock: { data: sizeStockSummary, error: null },
  })

  const reply = await buildDropsReplyIfIntent("quiero una camiseta")

  assert.match(reply ?? "", /sección Drops/i)
  assert.match(reply ?? "", /talla, color y cantidad/i)
})

test("chatbot no inventa tallas cuando el drop se vende sin talla", async () => {
  setMockClient({
    drops: { data: [{ ...noSizeDropRow, launch_at: "2026-01-01T00:00:00.000Z" }], error: null },
    stock: { data: { stock_total: 12, reserved_units: 0, ordered_units: 0, available_stock: 12 }, error: null },
    sizeStock: { data: [], error: null },
  })

  const sizeReply = await buildDropsReplyIfIntent("¿queda talla M?")
  assert.match(sizeReply ?? "", /sin selección de talla|sin talla/i)
  assert.doesNotMatch(sizeReply ?? "", /quedan \d+ unidades vendibles/i)

  const generalReply = await buildDropsReplyIfIntent("¿hay camisetas?")
  assert.match(generalReply ?? "", /Poster Tentados/)
  assert.match(generalReply ?? "", /12 unidades/)
  assert.match(generalReply ?? "", /sin selección de talla/i)
})

test("chatbot responde seguro sin drops o con fallo del módulo", async () => {
  setMockClient({ drops: { data: [], error: null } })
  assert.match(await buildDropsReplyIfIntent("¿hay camisetas?") ?? "", /no tenemos drops publicados/i)

  setMockClient({
    drops: {
      data: null,
      error: { code: "PGRST205", message: "Could not find the table 'public.drops' in the schema cache" },
    },
  })
  assert.match(await buildDropsReplyIfIntent("¿hay drops?") ?? "", /no puedo confirmar los drops/i)
})
