import assert from "node:assert/strict"
import test from "node:test"

import {
  DROP_SCHEMA_NOT_INITIALIZED_CODE,
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

function createQueryBuilder(response: MockResponse) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    lte: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    update: () => builder,
    single: () => Promise.resolve(response),
    maybeSingle: () => Promise.resolve(response),
    then: <TResult1 = MockResponse, TResult2 = never>(
      onfulfilled?: ((value: MockResponse) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise.resolve(response).then(onfulfilled, onrejected),
  }

  return builder
}

function setMockClient(input: { from?: Record<string, MockResponse>; rpc?: Record<string, MockResponse> }) {
  const fallback: MockResponse = { data: [], error: null, count: 0 }
  const client = {
    from: (table: string) => createQueryBuilder(input.from?.[table] ?? fallback),
    rpc: (name: string) => createQueryBuilder(input.rpc?.[name] ?? fallback),
  }

  setDropStoreClientForTests(client as unknown as Parameters<typeof setDropStoreClientForTests>[0])
}

const schemaCacheError = {
  code: "PGRST205",
  message: "Could not find the table 'public.drops' in the schema cache",
}

const dropInput: DropMutationInput = {
  slug: "camiseta-tentados",
  name: "Camiseta Tentados",
  description: "Drop de prueba",
  price: 25,
  imageUrls: [],
  colors: ["Burdeos"],
  sizes: ["M"],
  stockTotal: 30,
  launchAt: "2026-06-30T23:00:00.000Z",
  isActive: false,
  floatingEnabled: false,
  floatingMessage: "",
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

  assert.deepEqual(await listAdminDropsWithAvailability(), { availability: "READY", data: [] })
  assert.deepEqual(await listDropReservationsWithAvailability(), { availability: "READY", data: [] })
  assert.deepEqual(await listDropOrdersWithAvailability(), { availability: "READY", data: [] })
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
