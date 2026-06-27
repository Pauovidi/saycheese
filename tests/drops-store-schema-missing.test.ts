import assert from "node:assert/strict"
import test from "node:test"

import {
  DROP_CTA_MIGRATION_REQUIRED_CODE,
  DROP_SCHEMA_NOT_INITIALIZED_CODE,
  DropCtaMigrationRequiredError,
  DropStorageUnavailableError,
} from "../src/data/drop-storage-status"
import {
  cancelDropReservation,
  createDropRecord,
  createOrderWithItems,
  getHeroDrop,
  getPublicDropBySlug,
  hasPublicDropsNav,
  listAdminDropsWithAvailability,
  listDropOrdersWithAvailability,
  listDropReservationsWithAvailability,
  listPublicDrops,
  reserveDrop,
  setDropStoreClientForTests,
  type DropMutationInput,
} from "../src/data/drops-store"

type MockResponse = {
  data?: unknown
  error?: unknown
  count?: number | null
}

type MockResponseSource = MockResponse | MockResponse[]

function createQueryBuilder(response: MockResponse) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    lte: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    single: () => Promise.resolve(response),
    maybeSingle: () => Promise.resolve(response),
    then: <TResult1 = MockResponse, TResult2 = never>(
      onfulfilled?: ((value: MockResponse) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise.resolve(response).then(onfulfilled, onrejected),
  }

  return builder
}

function takeResponse(source: MockResponseSource | undefined, fallback: MockResponse) {
  if (Array.isArray(source)) return source.shift() ?? fallback
  return source ?? fallback
}

function setMockClient(input: { from?: Record<string, MockResponseSource>; rpc?: Record<string, MockResponseSource> }) {
  const fallback: MockResponse = { data: [], error: null, count: 0 }
  const client = {
    from: (table: string) => createQueryBuilder(takeResponse(input.from?.[table], fallback)),
    rpc: (name: string) => createQueryBuilder(takeResponse(input.rpc?.[name], fallback)),
  }

  setDropStoreClientForTests(client as unknown as Parameters<typeof setDropStoreClientForTests>[0])
}

const schemaCacheError = {
  code: "PGRST205",
  message: "Could not find the table 'public.drops' in the schema cache",
}

const ctaColumnMissingError = {
  code: "PGRST204",
  message: "Could not find the 'preorder_cta_text' column of 'drops' in the schema cache",
}

const archiveColumnMissingError = {
  code: "PGRST204",
  message: "Could not find the 'archived_at' column of 'drops' in the schema cache",
}

const sizeStockRpcMissingError = {
  code: "PGRST202",
  message: "Could not find the function public.get_drop_size_stock_summary(p_drop_id) in the schema cache",
}

const legacyDropRow = {
  id: "00000000-0000-0000-0000-000000000010",
  slug: "camiseta-tentados",
  name: "Camiseta Tentados",
  description: "Drop legacy",
  price: 25,
  image_urls: ["/images/drop.jpg"],
  colors: ["Burdeos"],
  sizes: ["M"],
  stock_total: 30,
  launch_at: "2026-06-30T23:00:00.000Z",
  launch_timezone: "Atlantic/Canary",
  is_active: true,
  floating_enabled: true,
  floating_message: "NUEVO DROP MUY PRONTO",
  is_closed: false,
  created_at: null,
  updated_at: null,
}

const dropInput: DropMutationInput = {
  slug: "camiseta-tentados",
  name: "Camiseta Tentados",
  description: "Drop de prueba",
  price: 25,
  imageUrls: [],
  colors: ["Burdeos"],
  sizes: ["M"],
  sizeStockEnabled: true,
  sizeStock: [{ size: "M", stockTotal: 30, position: 0 }],
  stockTotal: 30,
  launchAt: "2026-06-30T23:00:00.000Z",
  isActive: false,
  floatingEnabled: false,
  floatingMessage: "",
  preorderCtaText: "Preventa",
  isClosed: false,
}

test.afterEach(() => {
  setDropStoreClientForTests(null)
})

test("superficies públicas degradan sin 500 cuando falta la tabla drops", async () => {
  setMockClient({
    from: {
      drops: { data: null, error: schemaCacheError, count: null },
    },
    rpc: {
      get_drop_stock_summary: { data: null, error: schemaCacheError },
    },
  })

  assert.equal(await getHeroDrop(), null)
  assert.equal(await hasPublicDropsNav(), false)
  assert.deepEqual(await listPublicDrops(), [])
  assert.equal(await getPublicDropBySlug("camiseta-tentados"), null)
})

test("backoffice informa NOT_INITIALIZED y devuelve listas vacías seguras", async () => {
  setMockClient({
    from: {
      drops: { data: null, error: schemaCacheError },
      drop_reservations: { data: null, error: schemaCacheError },
      order_items: { data: null, error: schemaCacheError },
    },
  })

  const drops = await listAdminDropsWithAvailability()
  const reservations = await listDropReservationsWithAvailability()
  const orders = await listDropOrdersWithAvailability()

  assert.equal(drops.availability, "NOT_INITIALIZED")
  assert.equal(reservations.availability, "NOT_INITIALIZED")
  assert.equal(orders.availability, "NOT_INITIALIZED")
  assert.deepEqual(drops.data, [])
  assert.deepEqual(reservations.data, [])
  assert.deepEqual(orders.data, [])
  assert.match(drops.message, /migración/i)
})

test("mutaciones de drops fallan con 503 controlado cuando el schema no está aplicado", async () => {
  setMockClient({
    from: {
      drops: { data: null, error: schemaCacheError },
    },
    rpc: {
      create_drop_reservation: { data: null, error: schemaCacheError },
      cancel_drop_reservation: { data: null, error: schemaCacheError },
      create_order_with_items: { data: null, error: schemaCacheError },
    },
  })

  for (const operation of [
    () => createDropRecord(dropInput),
    () => reserveDrop({ dropId: "00000000-0000-0000-0000-000000000001", idempotencyKey: "test-key-123" }),
    () => cancelDropReservation({ reservationId: "00000000-0000-0000-0000-000000000002" }),
    () =>
      createOrderWithItems({
        userId: "00000000-0000-0000-0000-000000000003",
        deliveryDate: "2026-07-03",
        status: "pending",
        customerName: "Cliente",
        items: [
          {
            type: "drop" as const,
            drop_id: "00000000-0000-0000-0000-000000000001",
            selected_size: "M",
            selected_color: "Burdeos",
            qty: 1,
          },
        ],
      }),
  ]) {
    await assert.rejects(operation, (error: unknown) => {
      assert.ok(error instanceof DropStorageUnavailableError)
      assert.equal(error.status, 503)
      assert.equal(error.code, DROP_SCHEMA_NOT_INITIALIZED_CODE)
      assert.equal(error.availability, "NOT_INITIALIZED")
      return true
    })
  }
})

test("estado READY se conserva cuando la consulta responde sin error", async () => {
  setMockClient({
    from: {
      drops: { data: [], error: null },
      drop_reservations: { data: [], error: null },
      order_items: { data: [], error: null },
    },
  })

  assert.deepEqual(await listAdminDropsWithAvailability(), {
    availability: "READY",
    data: [],
    preorderCtaTextMigrated: true,
    capabilityMessage: undefined,
  })
  assert.deepEqual(await listDropReservationsWithAvailability(), {
    availability: "READY",
    data: [],
    preorderCtaTextMigrated: true,
    capabilityMessage: undefined,
  })
  assert.deepEqual(await listDropOrdersWithAvailability(), {
    availability: "READY",
    data: [],
    preorderCtaTextMigrated: true,
    capabilityMessage: undefined,
  })
})

test("columna preorder_cta_text ausente reintenta lectura legacy con CTA fallback", async () => {
  setMockClient({
    from: {
      drops: [
        { data: null, error: ctaColumnMissingError },
        { data: legacyDropRow, error: null },
        { data: null, error: ctaColumnMissingError },
        { data: [legacyDropRow], error: null },
      ],
    },
    rpc: {
      get_drop_stock_summary: [
        { data: { stock_total: 30, reserved_units: 0, ordered_units: 0, available_stock: 30 }, error: null },
        { data: { stock_total: 30, reserved_units: 0, ordered_units: 0, available_stock: 30 }, error: null },
      ],
    },
  })

  const heroDrop = await getHeroDrop()
  assert.equal(heroDrop?.preorderCtaText, "Preventa")

  const state = await listAdminDropsWithAvailability()
  assert.equal(state.availability, "READY")
  assert.equal(state.preorderCtaTextMigrated, false)
  assert.match(state.capabilityMessage ?? "", /CTA/)
  assert.equal(state.data[0]?.preorderCtaText, "Preventa")
})

test("migración de archivado y stock pendiente muestra mensaje específico en backoffice", async () => {
  setMockClient({
    from: {
      drops: [
        { data: null, error: archiveColumnMissingError },
        { data: [legacyDropRow], error: null },
      ],
    },
    rpc: {
      get_drop_stock_summary: { data: { stock_total: 30, reserved_units: 0, ordered_units: 0, available_stock: 30 }, error: null },
    },
  })

  const state = await listAdminDropsWithAvailability()
  assert.equal(state.availability, "READY")
  assert.equal(state.preorderCtaTextMigrated, false)
  assert.match(state.capabilityMessage ?? "", /archivado y stock por talla/i)
  assert.doesNotMatch(state.capabilityMessage ?? "", /CTA configurable/i)
  assert.equal(state.data[0]?.archivedAt, null)
})

test("RPC de stock por talla ausente mantiene lectura admin y marca migración pendiente", async () => {
  setMockClient({
    from: {
      drops: {
        data: [{ ...legacyDropRow, preorder_cta_text: "Preventa", archived_at: null, archived_by: null, archive_reason: null }],
        error: null,
      },
    },
    rpc: {
      get_drop_stock_summary: { data: { stock_total: 30, reserved_units: 7, ordered_units: 0, available_stock: 23 }, error: null },
      get_drop_size_stock_summary: { data: null, error: sizeStockRpcMissingError },
    },
  })

  const state = await listAdminDropsWithAvailability()
  assert.equal(state.availability, "READY")
  assert.equal(state.preorderCtaTextMigrated, false)
  assert.match(state.capabilityMessage ?? "", /stock por talla/i)
  assert.equal(state.data[0]?.stock.availableStock, 23)
  assert.equal(state.data[0]?.stock.sizeStock[0]?.size, "M")
  assert.equal(state.data[0]?.stock.sizeStock[0]?.sellableNow, 0)
})

test("RPC de stock por talla se combina con resumen global estable", async () => {
  setMockClient({
    from: {
      drops: {
        data: [{ ...legacyDropRow, sizes: ["M", "L"], preorder_cta_text: "Preventa", archived_at: null, archived_by: null, archive_reason: null }],
        error: null,
      },
    },
    rpc: {
      get_drop_stock_summary: { data: { stock_total: 30, reserved_units: 0, ordered_units: 28, available_stock: 2 }, error: null },
      get_drop_size_stock_summary: {
        data: [
          { size: "M", stock_total: 10, ordered_units: 3, available_raw: 7, sellable_now: 2, position: 0 },
          { size: "L", stock_total: 20, ordered_units: 25, available_raw: 0, sellable_now: 0, position: 1 },
        ],
        error: null,
      },
    },
  })

  const drops = await listPublicDrops(new Date("2026-07-01T00:00:00.000Z"))
  assert.equal(drops[0]?.stock.availableStock, 2)
  assert.equal(drops[0]?.stock.sizeStock.find((entry) => entry.size === "M")?.sellableNow, 2)
  assert.equal(drops[0]?.stock.sizeStock.find((entry) => entry.size === "L")?.availableRaw, 0)
})

test("schema antiguo no devuelve falso éxito al guardar CTA personalizado", async () => {
  setMockClient({
    from: {
      drops: { data: null, error: ctaColumnMissingError },
    },
  })

  await assert.rejects(
    () => createDropRecord({ ...dropInput, preorderCtaText: "QUIERO LA MÍA" }),
    (error: unknown) => {
      assert.ok(error instanceof DropCtaMigrationRequiredError)
      assert.equal(error.code, DROP_CTA_MIGRATION_REQUIRED_CODE)
      return true
    }
  )
})

test("errores inesperados se clasifican como UNAVAILABLE sin fingir migración pendiente", async () => {
  const timeoutError = { message: "fetch failed because the connection timed out" }
  setMockClient({
    from: {
      drops: { data: null, error: timeoutError },
    },
  })

  assert.equal(await getHeroDrop(), null)

  const state = await listAdminDropsWithAvailability()
  assert.equal(state.availability, "UNAVAILABLE")
  assert.match(state.message, /temporalmente/i)

  await assert.rejects(() => createDropRecord(dropInput), /fetch failed/)
})
