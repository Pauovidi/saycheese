import { getAdminClient } from "@/lib/supabase/admin"
import {
  DEFAULT_DROP_LAUNCH_AT_UTC,
  DROP_LAUNCH_TIME_ZONE,
  formatDropPrice,
  getDropPublicStatus,
  type DropPublicStatus,
  type DropStockNumbers,
} from "@/src/data/drops"

export type DropRow = {
  id: string
  slug: string
  name: string
  description: string | null
  price: number | string | null
  image_urls: unknown
  colors: unknown
  sizes: unknown
  stock_total: number | null
  launch_at: string | null
  launch_timezone: string | null
  is_active: boolean
  floating_enabled: boolean
  floating_message: string | null
  is_closed: boolean
  created_at: string | null
  updated_at: string | null
}

export type EditableDropRecord = {
  id: string
  slug: string
  name: string
  description: string
  price: number
  priceText: string
  imageUrls: string[]
  colors: string[]
  sizes: string[]
  stockTotal: number
  launchAt: string
  launchTimezone: string
  isActive: boolean
  floatingEnabled: boolean
  floatingMessage: string
  isClosed: boolean
  createdAt?: string | null
  updatedAt?: string | null
  stock: DropStockNumbers
  status: DropPublicStatus
}

export type DropMutationInput = {
  slug: string
  name: string
  description: string
  price: number
  imageUrls: string[]
  colors: string[]
  sizes: string[]
  stockTotal: number
  launchAt: string
  launchTimezone?: string
  isActive: boolean
  floatingEnabled: boolean
  floatingMessage: string
  isClosed: boolean
}

export type DropReservationListItem = {
  id: string
  createdAt: string
  dropId: string
  dropName: string
  dropSlug: string
  status: string
  quantity: number
  customerReference: string | null
  idempotencyKey: string
  cancelledAt: string | null
  cancellationReason: string | null
  stockEffect: string
}

export type DropOrderListItem = {
  id: string
  orderId: string
  createdAt: string
  deliveryDate: string
  status: string
  customerName: string | null
  phone: string | null
  dropName: string
  dropSlug: string
  size: string
  color: string
  quantity: number
  unitPrice: number
  priceText: string
}

export type OrderWithItemsInput = {
  userId: string
  deliveryDate: string
  status: string
  customerName: string
  customerEmail?: string | null
  phone?: string | null
  notes?: string | null
  reminderAt?: string | null
  reminderStatus?: string | null
  items: Array<
    | {
        type: "cake" | "box"
        flavor: string
        qty: number
      }
    | {
        type: "drop"
        drop_id: string
        qty: number
        selected_size: string
        selected_color: string
      }
  >
}

const DROP_COLUMNS = [
  "id",
  "slug",
  "name",
  "description",
  "price",
  "image_urls",
  "colors",
  "sizes",
  "stock_total",
  "launch_at",
  "launch_timezone",
  "is_active",
  "floating_enabled",
  "floating_message",
  "is_closed",
  "created_at",
  "updated_at",
].join(",")

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean)
}

function readNumber(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function isMissingSupabaseConfigError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /Faltan variables SUPABASE/i.test(message)
}

function mapSummary(value: unknown, fallbackStockTotal = 0): DropStockNumbers {
  const row = Array.isArray(value) ? value[0] : value
  const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {}
  const stockTotal = readNumber(record.stock_total as number | string | null, fallbackStockTotal)
  const reservedUnits = readNumber(record.reserved_units as number | string | null)
  const orderedUnits = readNumber(record.ordered_units as number | string | null)
  const availableStock = readNumber(record.available_stock as number | string | null, Math.max(0, stockTotal - reservedUnits - orderedUnits))

  return {
    stockTotal,
    reservedUnits,
    orderedUnits,
    availableStock,
  }
}

export function mapDropRow(row: DropRow, stock: DropStockNumbers, now: Date = new Date()): EditableDropRecord {
  const price = readNumber(row.price)
  const launchAt = row.launch_at ?? DEFAULT_DROP_LAUNCH_AT_UTC

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    price,
    priceText: formatDropPrice(price),
    imageUrls: readStringArray(row.image_urls),
    colors: readStringArray(row.colors),
    sizes: readStringArray(row.sizes),
    stockTotal: row.stock_total ?? stock.stockTotal,
    launchAt,
    launchTimezone: row.launch_timezone ?? DROP_LAUNCH_TIME_ZONE,
    isActive: Boolean(row.is_active),
    floatingEnabled: Boolean(row.floating_enabled),
    floatingMessage: row.floating_message ?? "",
    isClosed: Boolean(row.is_closed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stock,
    status: getDropPublicStatus(
      {
        isActive: Boolean(row.is_active),
        isClosed: Boolean(row.is_closed),
        launchAt,
        availableStock: stock.availableStock,
      },
      now
    ),
  }
}

function mutationRow(input: DropMutationInput) {
  return {
    slug: input.slug,
    name: input.name,
    description: input.description,
    price: input.price,
    image_urls: input.imageUrls,
    colors: input.colors,
    sizes: input.sizes,
    stock_total: input.stockTotal,
    launch_at: input.launchAt,
    launch_timezone: input.launchTimezone ?? DROP_LAUNCH_TIME_ZONE,
    is_active: input.isActive,
    floating_enabled: input.floatingEnabled,
    floating_message: input.floatingMessage,
    is_closed: input.isClosed,
  }
}

function buildRevisionSnapshot(drop: EditableDropRecord) {
  return {
    slug: drop.slug,
    name: drop.name,
    description: drop.description,
    price: drop.price,
    imageUrls: drop.imageUrls,
    colors: drop.colors,
    sizes: drop.sizes,
    stockTotal: drop.stockTotal,
    launchAt: drop.launchAt,
    launchTimezone: drop.launchTimezone,
    isActive: drop.isActive,
    floatingEnabled: drop.floatingEnabled,
    floatingMessage: drop.floatingMessage,
    isClosed: drop.isClosed,
    status: drop.status,
    stock: drop.stock,
  }
}

async function insertRevision(input: { drop: EditableDropRecord; action: string; actor?: string | null }) {
  const supabase = getAdminClient()
  const { error } = await supabase.from("drop_revisions").insert({
    drop_id: input.drop.id,
    action: input.action,
    slug: input.drop.slug,
    snapshot: buildRevisionSnapshot(input.drop),
    actor: input.actor ?? null,
  })

  if (error) throw new Error(error.message)
}

export async function getDropStockSummary(dropId: string): Promise<DropStockNumbers> {
  const supabase = getAdminClient()
  const { data, error } = await supabase.rpc("get_drop_stock_summary", {
    p_drop_id: dropId,
  })

  if (error) throw new Error(error.message)
  return mapSummary(data)
}

async function mapRowsWithStock(rows: DropRow[], now: Date = new Date()) {
  return Promise.all(
    rows.map(async (row) => {
      const stock = await getDropStockSummary(row.id)
      return mapDropRow(row, stock, now)
    })
  )
}

export async function listAdminDrops(now: Date = new Date()) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from("drops")
    .select(DROP_COLUMNS)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return mapRowsWithStock((data ?? []) as unknown as DropRow[], now)
}

export async function getHeroDrop(now: Date = new Date()) {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from("drops")
      .select(DROP_COLUMNS)
      .eq("is_active", true)
      .eq("is_closed", false)
      .order("launch_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null

    const stock = await getDropStockSummary((data as unknown as DropRow).id)
    return mapDropRow(data as unknown as DropRow, stock, now)
  } catch (error) {
    if (isMissingSupabaseConfigError(error)) return null
    throw error
  }
}

export async function hasPublicDropsNav(now: Date = new Date()) {
  try {
    const supabase = getAdminClient()
    const { count, error } = await supabase
      .from("drops")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_closed", false)
      .lte("launch_at", now.toISOString())

    if (error) throw new Error(error.message)
    return (count ?? 0) > 0
  } catch (error) {
    if (isMissingSupabaseConfigError(error)) return false
    throw error
  }
}

export async function listPublicDrops(now: Date = new Date()) {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from("drops")
      .select(DROP_COLUMNS)
      .eq("is_active", true)
      .eq("is_closed", false)
      .lte("launch_at", now.toISOString())
      .order("launch_at", { ascending: false })

    if (error) throw new Error(error.message)
    return mapRowsWithStock((data ?? []) as unknown as DropRow[], now)
  } catch (error) {
    if (isMissingSupabaseConfigError(error)) return []
    throw error
  }
}

export async function getPublicDropBySlug(slug: string, now: Date = new Date()) {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from("drops")
      .select(DROP_COLUMNS)
      .eq("slug", slug)
      .eq("is_active", true)
      .eq("is_closed", false)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null

    const stock = await getDropStockSummary((data as unknown as DropRow).id)
    const drop = mapDropRow(data as unknown as DropRow, stock, now)
    return drop.status === "LIVE" || drop.status === "SOLD_OUT" ? drop : null
  } catch (error) {
    if (isMissingSupabaseConfigError(error)) return null
    throw error
  }
}

export async function createDropRecord(input: DropMutationInput, actor?: string | null) {
  const supabase = getAdminClient()
  const { data, error } = await supabase.from("drops").insert(mutationRow(input)).select(DROP_COLUMNS).single()

  if (error) throw new Error(error.message)
  const stock = await getDropStockSummary((data as unknown as DropRow).id)
  const drop = mapDropRow(data as unknown as DropRow, stock)
  await insertRevision({ drop, action: "create", actor })
  return drop
}

export async function updateDropRecord(id: string, input: DropMutationInput, actor?: string | null) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from("drops")
    .update(mutationRow(input))
    .eq("id", id)
    .select(DROP_COLUMNS)
    .single()

  if (error) throw new Error(error.message)
  const stock = await getDropStockSummary((data as unknown as DropRow).id)
  const drop = mapDropRow(data as unknown as DropRow, stock)
  await insertRevision({ drop, action: "update", actor })
  return drop
}

export async function reserveDrop(input: {
  dropId: string
  idempotencyKey: string
  customerReference?: string | null
}) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .rpc("create_drop_reservation", {
      p_drop_id: input.dropId,
      p_idempotency_key: input.idempotencyKey,
      p_customer_reference: input.customerReference ?? null,
    })
    .single()

  if (error) throw new Error(error.message)

  const row = data as unknown as {
    reservation_id: string
    reservation_status: string
    available_stock: number
    reused_existing: boolean
  }

  return {
    reservationId: row.reservation_id,
    status: row.reservation_status,
    availableStock: row.available_stock,
    reusedExisting: row.reused_existing,
  }
}

export async function cancelDropReservation(input: { reservationId: string; reason?: string | null }) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .rpc("cancel_drop_reservation", {
      p_reservation_id: input.reservationId,
      p_reason: input.reason ?? null,
    })
    .single()

  if (error) throw new Error(error.message)

  const row = data as unknown as {
    reservation_id: string
    reservation_status: string
    available_stock: number
    changed: boolean
  }

  return {
    reservationId: row.reservation_id,
    status: row.reservation_status,
    availableStock: row.available_stock,
    changed: row.changed,
  }
}

export async function createOrderWithItems(input: OrderWithItemsInput) {
  const supabase = getAdminClient()
  const { data, error } = await supabase.rpc("create_order_with_items", {
    p_user_id: input.userId,
    p_delivery_date: input.deliveryDate,
    p_status: input.status,
    p_customer_name: input.customerName,
    p_customer_email: input.customerEmail ?? null,
    p_phone: input.phone ?? null,
    p_notes: input.notes ?? null,
    p_reminder_at: input.reminderAt ?? null,
    p_reminder_status: input.reminderStatus ?? null,
    p_items: input.items,
  })

  if (error) throw new Error(error.message)
  if (typeof data !== "string") throw new Error("No se pudo crear el pedido")
  return { id: data }
}

export async function listDropReservations(): Promise<DropReservationListItem[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from("drop_reservations")
    .select("id, created_at, drop_id, quantity, status, idempotency_key, customer_reference, cancelled_at, cancellation_reason, drops(name, slug)")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => {
    const drop = Array.isArray(row.drops) ? row.drops[0] : (row.drops as Record<string, unknown> | null)
    const status = String(row.status ?? "active")

    return {
      id: String(row.id),
      createdAt: String(row.created_at),
      dropId: String(row.drop_id),
      dropName: String(drop?.name ?? "Drop"),
      dropSlug: String(drop?.slug ?? ""),
      status,
      quantity: readNumber(row.quantity as number | string | null, 1),
      customerReference: row.customer_reference ? String(row.customer_reference) : null,
      idempotencyKey: String(row.idempotency_key ?? ""),
      cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
      cancellationReason: row.cancellation_reason ? String(row.cancellation_reason) : null,
      stockEffect: status === "active" ? "-1 unidad" : "Sin consumo",
    }
  })
}

export async function listDropOrders(): Promise<DropOrderListItem[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, order_id, drop_id, product_name, unit_price, selected_size, selected_color, qty, orders!inner(id, created_at, delivery_date, status, customer_name, phone), drops(name, slug)"
    )
    .eq("type", "drop")
    .order("id", { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => {
    const order = Array.isArray(row.orders) ? row.orders[0] : (row.orders as Record<string, unknown> | null)
    const drop = Array.isArray(row.drops) ? row.drops[0] : (row.drops as Record<string, unknown> | null)
    const unitPrice = readNumber(row.unit_price as number | string | null)

    return {
      id: String(row.id),
      orderId: String(row.order_id),
      createdAt: String(order?.created_at ?? ""),
      deliveryDate: String(order?.delivery_date ?? ""),
      status: String(order?.status ?? ""),
      customerName: order?.customer_name ? String(order.customer_name) : null,
      phone: order?.phone ? String(order.phone) : null,
      dropName: String(row.product_name ?? drop?.name ?? "Drop"),
      dropSlug: String(drop?.slug ?? ""),
      size: String(row.selected_size ?? ""),
      color: String(row.selected_color ?? ""),
      quantity: readNumber(row.qty as number | string | null, 1),
      unitPrice,
      priceText: formatDropPrice(unitPrice),
    }
  })
}
