import { getAdminClient } from "@/lib/supabase/admin"
import {
  DEFAULT_DROP_LAUNCH_AT_UTC,
  DEFAULT_DROP_PREORDER_CTA_TEXT,
  DROP_LAUNCH_TIME_ZONE,
  formatDropPrice,
  buildDropSizeStockNumbers,
  getDropPublicStatus,
  normalizeDropPreorderCtaText,
  type DropPublicStatus,
  type DropSizeStockNumbers,
  type DropStockNumbers,
} from "@/src/data/drops"
import {
  DropArchiveSizeStockMigrationRequiredError,
  DropCtaMigrationRequiredError,
  DropStorageUnavailableError,
  type DropModuleAvailability,
  classifyDropStorageError,
  getDropAdminUnavailableMessage,
  getDropStorageErrorMessage,
  isDropArchiveOrSizeStockMissingError,
  isDropPreorderCtaColumnMissingError,
  logDropStorageIssueOnce,
  toDropStorageUnavailableError,
} from "@/src/data/drop-storage-status"

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
  size_stock_enabled?: boolean | null
  launch_at: string | null
  launch_timezone: string | null
  is_active: boolean
  floating_enabled: boolean
  floating_message: string | null
  preorder_cta_text?: string | null
  is_closed: boolean
  archived_at?: string | null
  archived_by?: string | null
  archive_reason?: string | null
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
  sizeStockEnabled: boolean
  launchAt: string
  launchTimezone: string
  isActive: boolean
  floatingEnabled: boolean
  floatingMessage: string
  preorderCtaText: string
  isClosed: boolean
  archivedAt: string | null
  archivedBy: string | null
  archiveReason: string | null
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
  sizeStockEnabled: boolean
  launchAt: string
  launchTimezone?: string
  isActive: boolean
  floatingEnabled: boolean
  floatingMessage: string
  preorderCtaText: string
  isClosed: boolean
  sizeStock: Array<{ size: string; stockTotal: number; position: number }>
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
  customerName: string | null
  phone: string | null
  selectedSize: string | null
  selectedColor: string | null
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

export type DropAdminModuleState<T> =
  | {
      availability: "READY"
      data: T
      message?: undefined
      preorderCtaTextMigrated: boolean
      capabilityMessage?: string
    }
  | {
      availability: Exclude<DropModuleAvailability, "READY">
      data: T
      message: string
      preorderCtaTextMigrated: boolean
      capabilityMessage?: string
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
        selected_size?: string | null
        selected_color: string
      }
  >
}

const LEGACY_DROP_COLUMNS = [
  "id",
  "slug",
  "name",
  "description",
  "price",
  "image_urls",
  "colors",
  "sizes",
  "stock_total",
  "size_stock_enabled",
  "launch_at",
  "launch_timezone",
  "is_active",
  "floating_enabled",
  "floating_message",
  "is_closed",
  "created_at",
  "updated_at",
].join(",")

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
  "size_stock_enabled",
  "launch_at",
  "launch_timezone",
  "is_active",
  "floating_enabled",
  "floating_message",
  "preorder_cta_text",
  "is_closed",
  "archived_at",
  "archived_by",
  "archive_reason",
  "created_at",
  "updated_at",
].join(",")

type DropStoreClient = ReturnType<typeof getAdminClient>
type DropStockSummaryResult = {
  stock: DropStockNumbers
  sizeStockMigrated: boolean
}
type DropSizeStockRow = {
  id: string
  drop_id: string
  size: string
  stock_total: number | string | null
  position: number | string | null
  is_active?: boolean | null
  archived_at?: string | null
}

let dropStoreClientForTests: DropStoreClient | null = null

export function setDropStoreClientForTests(client: DropStoreClient | null) {
  dropStoreClientForTests = client
}

function getDropClient() {
  return dropStoreClientForTests ?? getAdminClient()
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean)
}

function readNumber(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toDropMutationError(error: unknown, operation: string) {
  if (isDropArchiveOrSizeStockMissingError(error)) {
    logDropStorageIssueOnce({ operation, availability: "UNAVAILABLE", error })
    return new DropArchiveSizeStockMigrationRequiredError()
  }

  if (isDropPreorderCtaColumnMissingError(error)) {
    logDropStorageIssueOnce({ operation, availability: "UNAVAILABLE", error })
    return new DropCtaMigrationRequiredError()
  }

  if (classifyDropStorageError(error) === "NOT_INITIALIZED") {
    return toDropStorageUnavailableError(error, operation)
  }

  return error instanceof Error ? error : new Error(getDropStorageErrorMessage(error))
}

function logDropCaughtError(error: unknown, operation: string) {
  if (error instanceof DropStorageUnavailableError) {
    return error.availability
  }

  const availability = classifyDropStorageError(error)
  logDropStorageIssueOnce({ operation, availability, error })
  return availability
}

function dropUnavailableState<T>(
  availability: Exclude<DropModuleAvailability, "READY">,
  data: T
): DropAdminModuleState<T> {
  return {
    availability,
    data,
    message: getDropAdminUnavailableMessage(availability),
    preorderCtaTextMigrated: false,
  }
}

function dropReadyState<T>(data: T, preorderCtaTextMigrated = true, capabilityMessage?: string): DropAdminModuleState<T> {
  return {
    availability: "READY",
    data,
    preorderCtaTextMigrated,
    capabilityMessage: preorderCtaTextMigrated
      ? undefined
      : capabilityMessage ??
        "La columna del CTA de preventa todavía no está migrada. Puedes previsualizar con fallback, pero no guardar un CTA personalizado.",
  }
}

function readSizeStockSummary(value: unknown, sizes: string[], globalAvailable: number): DropSizeStockNumbers[] {
  const rows = Array.isArray(value) ? value : []
  const totals = rows.map((entry, index) => {
    const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
    return {
      size: String(record.size ?? "").trim(),
      stockTotal: readNumber(record.stock_total as number | string | null),
      position: readNumber(record.position as number | string | null, index),
    }
  }).filter((entry) => entry.size)
  const ordered = Object.fromEntries(rows.map((entry) => {
    const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
    const size = String(record.size ?? "").trim().toLocaleLowerCase("es")
    return [size, readNumber(record.ordered_units as number | string | null)]
  }))

  return buildDropSizeStockNumbers({
    sizes,
    sizeStockTotals: totals,
    orderedUnitsBySize: ordered,
    globalAvailable,
  })
}

function mapSummary(value: unknown, fallbackStockTotal = 0, sizes: string[] = []): DropStockNumbers {
  const row = Array.isArray(value) ? value[0] : value
  const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {}
  const stockTotal = readNumber(record.stock_total as number | string | null, fallbackStockTotal)
  const reservedUnits = readNumber(record.reserved_units as number | string | null)
  const orderedUnits = readNumber(record.ordered_units as number | string | null)
  const availableStock = readNumber(record.available_stock as number | string | null, Math.max(0, stockTotal - reservedUnits - orderedUnits))
  const sizeStock = readSizeStockSummary([], sizes, availableStock)

  return {
    stockTotal,
    reservedUnits,
    orderedUnits,
    availableStock,
    sizeStock,
  }
}

async function getDropSizeStockSummary(dropId: string, sizes: string[], globalAvailable: number) {
  const supabase = getDropClient()
  const { data, error } = await supabase.rpc("get_drop_size_stock_summary", {
    p_drop_id: dropId,
  })

  if (error) {
    if (isDropArchiveOrSizeStockMissingError(error)) {
      logDropStorageIssueOnce({ operation: "getDropSizeStockSummary", availability: classifyDropStorageError(error), error })
      return {
        sizeStock: readSizeStockSummary([], sizes, globalAvailable),
        migrated: false,
      }
    }
    throw toDropStorageUnavailableError(error, "getDropSizeStockSummary")
  }

  return {
    sizeStock: readSizeStockSummary(data, sizes, globalAvailable),
    migrated: true,
  }
}

export function mapDropRow(row: DropRow, stock: DropStockNumbers, now: Date = new Date()): EditableDropRecord {
  const price = readNumber(row.price)
  const launchAt = row.launch_at ?? DEFAULT_DROP_LAUNCH_AT_UTC
  const sizeStockEnabled = row.size_stock_enabled ?? stock.sizeStock.length > 0

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
    stockTotal: sizeStockEnabled ? stock.stockTotal : row.stock_total ?? stock.stockTotal,
    sizeStockEnabled,
    launchAt,
    launchTimezone: row.launch_timezone ?? DROP_LAUNCH_TIME_ZONE,
    isActive: Boolean(row.is_active),
    floatingEnabled: Boolean(row.floating_enabled),
    floatingMessage: row.floating_message ?? "",
    preorderCtaText: normalizeDropPreorderCtaText(row.preorder_cta_text),
    isClosed: Boolean(row.is_closed),
    archivedAt: row.archived_at ?? null,
    archivedBy: row.archived_by ?? null,
    archiveReason: row.archive_reason ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stock,
    status: getDropPublicStatus(
      {
        isActive: Boolean(row.is_active),
        isClosed: Boolean(row.is_closed),
        archivedAt: row.archived_at ?? null,
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
    stock_total: input.sizeStockEnabled
      ? input.sizeStock.reduce((sum, entry) => sum + Math.max(0, Math.trunc(entry.stockTotal)), 0)
      : input.stockTotal,
    size_stock_enabled: input.sizeStockEnabled,
    launch_at: input.launchAt,
    launch_timezone: input.launchTimezone ?? DROP_LAUNCH_TIME_ZONE,
    is_active: input.isActive,
    floating_enabled: input.floatingEnabled,
    floating_message: input.floatingMessage,
    preorder_cta_text: normalizeDropPreorderCtaText(input.preorderCtaText),
    is_closed: input.isClosed,
  }
}

function hasCustomPreorderCtaText(input: DropMutationInput) {
  return normalizeDropPreorderCtaText(input.preorderCtaText) !== DEFAULT_DROP_PREORDER_CTA_TEXT
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
    sizeStockEnabled: drop.sizeStockEnabled,
    launchAt: drop.launchAt,
    launchTimezone: drop.launchTimezone,
    isActive: drop.isActive,
    floatingEnabled: drop.floatingEnabled,
    floatingMessage: drop.floatingMessage,
    preorderCtaText: drop.preorderCtaText,
    isClosed: drop.isClosed,
    archivedAt: drop.archivedAt,
    archivedBy: drop.archivedBy,
    archiveReason: drop.archiveReason,
    status: drop.status,
    stock: drop.stock,
  }
}

async function insertRevision(input: { drop: EditableDropRecord; action: string; actor?: string | null }) {
  const supabase = getDropClient()
  const { error } = await supabase.from("drop_revisions").insert({
    drop_id: input.drop.id,
    action: input.action,
    slug: input.drop.slug,
    snapshot: buildRevisionSnapshot(input.drop),
    actor: input.actor ?? null,
  })

  if (error) throw toDropMutationError(error, "insertRevision")
}

export async function getDropStockSummaryWithCapabilities(dropId: string, sizes: string[] = []): Promise<DropStockSummaryResult> {
  const supabase = getDropClient()
  const { data, error } = await supabase.rpc("get_drop_stock_summary", {
    p_drop_id: dropId,
  })

  if (error) throw toDropStorageUnavailableError(error, "getDropStockSummary")
  const stock = mapSummary(data, 0, sizes)
  const sizeStockResult = await getDropSizeStockSummary(dropId, sizes, stock.availableStock)

  return {
    stock: {
      ...stock,
      sizeStock: sizeStockResult.sizeStock,
    },
    sizeStockMigrated: sizeStockResult.migrated,
  }
}

export async function getDropStockSummary(dropId: string, sizes: string[] = []): Promise<DropStockNumbers> {
  const result = await getDropStockSummaryWithCapabilities(dropId, sizes)
  return result.stock
}

async function mapRowsWithStock(rows: DropRow[], now: Date = new Date()) {
  const results = await Promise.all(
    rows.map(async (row) => {
      const stockResult = await getDropStockSummaryWithCapabilities(row.id, readStringArray(row.sizes))
      return {
        drop: mapDropRow(row, stockResult.stock, now),
        sizeStockMigrated: stockResult.sizeStockMigrated,
      }
    })
  )

  return {
    drops: results.map((result) => result.drop),
    sizeStockMigrated: results.every((result) => result.sizeStockMigrated),
  }
}

async function readDropRowsWithCtaFallback(
  operation: string,
  runQuery: (columns: string) => PromiseLike<{ data: unknown; error: unknown; count?: number | null }>
) {
  const result = await runQuery(DROP_COLUMNS)

  if (result.error && isDropPreorderCtaColumnMissingError(result.error)) {
    logDropStorageIssueOnce({ operation, availability: "UNAVAILABLE", error: result.error })
    const legacyResult = await runQuery(LEGACY_DROP_COLUMNS)
    if (legacyResult.error) throw toDropStorageUnavailableError(legacyResult.error, operation)
    return {
      data: legacyResult.data,
      count: legacyResult.count,
      preorderCtaTextMigrated: false,
      capabilityMessage:
        "La columna del CTA de preventa todavía no está migrada. Puedes previsualizar con fallback, pero no guardar un CTA personalizado.",
    }
  }

  if (result.error && isDropArchiveOrSizeStockMissingError(result.error)) {
    logDropStorageIssueOnce({ operation, availability: "UNAVAILABLE", error: result.error })
    const legacyResult = await runQuery(LEGACY_DROP_COLUMNS)
    if (legacyResult.error) throw toDropStorageUnavailableError(legacyResult.error, operation)
    return {
      data: legacyResult.data,
      count: legacyResult.count,
      preorderCtaTextMigrated: false,
      capabilityMessage:
        "La migración de archivado y stock por talla todavía no está aplicada. Las lecturas usan fallback legacy; guardar, archivar o editar stock falla cerrado hasta migrar.",
    }
  }

  if (result.error) throw toDropStorageUnavailableError(result.error, operation)

  return {
    data: result.data,
    count: result.count,
    preorderCtaTextMigrated: true,
    capabilityMessage: undefined,
  }
}

export async function listAdminDrops(now: Date = new Date()) {
  const result = await listAdminDropsWithCapabilities(now)
  return result.drops
}

export async function listAdminDropsWithCapabilities(now: Date = new Date()) {
  const supabase = getDropClient()
  const result = await readDropRowsWithCtaFallback("listAdminDrops", (columns) =>
    supabase.from("drops").select(columns).order("created_at", { ascending: false })
  )
  const mapped = await mapRowsWithStock((result.data ?? []) as unknown as DropRow[], now)
  const stockCapabilityMessage =
    "La migración de archivado y stock por talla todavía no está aplicada. Las lecturas usan fallback legacy; guardar, archivar o editar stock falla cerrado hasta migrar."
  const fullyMigrated = result.preorderCtaTextMigrated && mapped.sizeStockMigrated

  return {
    drops: mapped.drops,
    preorderCtaTextMigrated: fullyMigrated,
    capabilityMessage: fullyMigrated ? result.capabilityMessage : result.capabilityMessage ?? stockCapabilityMessage,
  }
}

function normalizeDropSizeKey(size: string) {
  return size.trim().toLocaleLowerCase("es")
}

function dedupeSizeStockInput(sizeStock: DropMutationInput["sizeStock"]) {
  const desired = new Map<string, { size: string; stockTotal: number; position: number }>()
  for (const [index, entry] of sizeStock.entries()) {
    const size = entry.size.trim()
    if (!size) continue
    const key = normalizeDropSizeKey(size)
    if (desired.has(key)) throw new Error(`Talla duplicada en el stock del drop: ${size}`)
    desired.set(key, {
      size,
      stockTotal: Math.max(0, Math.trunc(entry.stockTotal)),
      position: Math.max(0, Math.trunc(entry.position ?? index)),
    })
  }
  return desired
}

async function assertDropArchiveSizeStockSchemaReady(operation: string) {
  const supabase = getDropClient()
  const archiveCheck = await supabase.from("drops").select("archived_at, archived_by, archive_reason, size_stock_enabled").limit(1)
  if (archiveCheck.error) throw toDropMutationError(archiveCheck.error, `${operation}.archiveSchema`)

  const sizeCheck = await supabase.from("drop_size_stock").select("id, size, stock_total, position, is_active, archived_at, archived_by").limit(1)
  if (sizeCheck.error) throw toDropMutationError(sizeCheck.error, `${operation}.sizeStockSchema`)
}

async function syncDropSizeStock(dropId: string, sizeStock: DropMutationInput["sizeStock"]) {
  const supabase = getDropClient()
  const desired = dedupeSizeStockInput(sizeStock)
  const { data, error: readError } = await supabase
    .from("drop_size_stock")
    .select("id, drop_id, size, stock_total, position, is_active, archived_at")
    .eq("drop_id", dropId)

  if (readError) throw toDropMutationError(readError, "syncDropSizeStock.read")

  const existingRows = ((data ?? []) as unknown as DropSizeStockRow[]).filter((row) => row.id && row.size)
  const existingBySize = new Map(existingRows.map((row) => [normalizeDropSizeKey(row.size), row]))

  for (const [key, entry] of desired.entries()) {
    const existing = existingBySize.get(key)
    if (existing) {
      const { error } = await supabase
        .from("drop_size_stock")
        .update({
          size: entry.size,
          stock_total: entry.stockTotal,
          position: entry.position,
          is_active: true,
          archived_at: null,
          archived_by: null,
        })
        .eq("id", existing.id)
      if (error) throw toDropMutationError(error, "syncDropSizeStock.update")
      continue
    }

    const { error } = await supabase.from("drop_size_stock").insert({
      drop_id: dropId,
      size: entry.size,
      stock_total: entry.stockTotal,
      position: entry.position,
      is_active: true,
      archived_at: null,
      archived_by: null,
    })
    if (error) throw toDropMutationError(error, "syncDropSizeStock.insert")
  }

  const archivedAt = new Date().toISOString()
  for (const row of existingRows) {
    const key = normalizeDropSizeKey(row.size)
    if (desired.has(key) || row.archived_at) continue

    const { error } = await supabase
      .from("drop_size_stock")
      .update({
        stock_total: 0,
        is_active: false,
        archived_at: archivedAt,
      })
      .eq("id", row.id)
    if (error) throw toDropMutationError(error, "syncDropSizeStock.archive")
  }
}

export async function listAdminDropsWithAvailability(now: Date = new Date()): Promise<DropAdminModuleState<EditableDropRecord[]>> {
  try {
    const result = await listAdminDropsWithCapabilities(now)
    return dropReadyState(result.drops, result.preorderCtaTextMigrated, result.capabilityMessage)
  } catch (error) {
    const availability = logDropCaughtError(error, "listAdminDropsWithAvailability")
    return dropUnavailableState(availability, [])
  }
}

export async function getHeroDrop(now: Date = new Date()) {
  try {
    const supabase = getDropClient()
    const { data } = await readDropRowsWithCtaFallback("getHeroDrop", (columns) => {
      const query = supabase
        .from("drops")
        .select(columns)
        .eq("is_active", true)
        .eq("is_closed", false)
        .eq("floating_enabled", true)
        .gt("launch_at", now.toISOString())
        .order("launch_at", { ascending: true })
        .limit(1)
      return columns === LEGACY_DROP_COLUMNS ? query.maybeSingle() : query.is("archived_at", null).maybeSingle()
    })

    if (!data) return null

    const stock = await getDropStockSummary((data as unknown as DropRow).id, readStringArray((data as unknown as DropRow).sizes))
    return mapDropRow(data as unknown as DropRow, stock, now)
  } catch (error) {
    logDropCaughtError(error, "getHeroDrop")
    return null
  }
}

export async function hasPublicDropsNav(_now: Date = new Date()) {
  try {
    const supabase = getDropClient()
    const { count, error } = await supabase
      .from("drops")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_closed", false)
      .is("archived_at", null)

    if (error && isDropArchiveOrSizeStockMissingError(error)) {
      const legacy = await supabase
        .from("drops")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("is_closed", false)
      if (legacy.error) throw toDropStorageUnavailableError(legacy.error, "hasPublicDropsNav")
      return (legacy.count ?? 0) > 0
    }

    if (error) throw toDropStorageUnavailableError(error, "hasPublicDropsNav")
    return (count ?? 0) > 0
  } catch (error) {
    logDropCaughtError(error, "hasPublicDropsNav")
    return false
  }
}

export async function listPublicDrops(now: Date = new Date()) {
  try {
    const supabase = getDropClient()
    const { data } = await readDropRowsWithCtaFallback("listPublicDrops", (columns) => {
      const query = supabase
        .from("drops")
        .select(columns)
        .eq("is_active", true)
        .eq("is_closed", false)
        .order("launch_at", { ascending: false })
      return columns === LEGACY_DROP_COLUMNS ? query : query.is("archived_at", null)
    })

    return (await mapRowsWithStock((data ?? []) as unknown as DropRow[], now)).drops
  } catch (error) {
    logDropCaughtError(error, "listPublicDrops")
    return []
  }
}

export async function getPublicDropBySlug(slug: string, now: Date = new Date()) {
  try {
    const supabase = getDropClient()
    const { data } = await readDropRowsWithCtaFallback("getPublicDropBySlug", (columns) => {
      const query = supabase
        .from("drops")
        .select(columns)
        .eq("slug", slug)
        .eq("is_active", true)
        .eq("is_closed", false)
      return columns === LEGACY_DROP_COLUMNS ? query.maybeSingle() : query.is("archived_at", null).maybeSingle()
    })

    if (!data) return null

    const stock = await getDropStockSummary((data as unknown as DropRow).id, readStringArray((data as unknown as DropRow).sizes))
    const drop = mapDropRow(data as unknown as DropRow, stock, now)
    return drop.status === "PRELAUNCH" || drop.status === "LIVE" || drop.status === "SOLD_OUT" ? drop : null
  } catch (error) {
    logDropCaughtError(error, "getPublicDropBySlug")
    return null
  }
}

export async function createDropRecord(input: DropMutationInput, actor?: string | null) {
  const supabase = getDropClient()
  await assertDropArchiveSizeStockSchemaReady("createDropRecord")
  let { data, error } = await supabase.from("drops").insert(mutationRow(input)).select(DROP_COLUMNS).single()

  if (error && isDropPreorderCtaColumnMissingError(error)) {
    if (hasCustomPreorderCtaText(input)) throw new DropCtaMigrationRequiredError()
    throw new DropArchiveSizeStockMigrationRequiredError()
  }

  if (error) throw toDropMutationError(error, "createDropRecord")
  await syncDropSizeStock((data as unknown as DropRow).id, input.sizeStock)
  const stock = await getDropStockSummary((data as unknown as DropRow).id, readStringArray((data as unknown as DropRow).sizes))
  const drop = mapDropRow(data as unknown as DropRow, stock)
  await insertRevision({ drop, action: "create", actor })
  return drop
}

export async function updateDropRecord(id: string, input: DropMutationInput, actor?: string | null) {
  const supabase = getDropClient()
  await assertDropArchiveSizeStockSchemaReady("updateDropRecord")
  let { data, error } = await supabase
    .from("drops")
    .update(mutationRow(input))
    .eq("id", id)
    .select(DROP_COLUMNS)
    .single()

  if (error && isDropPreorderCtaColumnMissingError(error)) {
    if (hasCustomPreorderCtaText(input)) throw new DropCtaMigrationRequiredError()
    throw new DropArchiveSizeStockMigrationRequiredError()
  }

  if (error) throw toDropMutationError(error, "updateDropRecord")
  await syncDropSizeStock((data as unknown as DropRow).id, input.sizeStock)
  const stock = await getDropStockSummary((data as unknown as DropRow).id, readStringArray((data as unknown as DropRow).sizes))
  const drop = mapDropRow(data as unknown as DropRow, stock)
  await insertRevision({ drop, action: "update", actor })
  return drop
}

export async function listChatbotDrops(now: Date = new Date()) {
  try {
    const supabase = getDropClient()
    const { data } = await readDropRowsWithCtaFallback("listChatbotDrops", (columns) => {
      const query = supabase
        .from("drops")
        .select(columns)
        .eq("is_active", true)
        .eq("is_closed", false)
        .order("launch_at", { ascending: true })
      return columns === LEGACY_DROP_COLUMNS ? query : query.is("archived_at", null)
    })

    return (await mapRowsWithStock((data ?? []) as unknown as DropRow[], now)).drops
  } catch (error) {
    logDropCaughtError(error, "listChatbotDrops")
    return null
  }
}

export async function archiveDropRecord(input: { id: string; actor?: string | null; reason?: string | null }) {
  const supabase = getDropClient()
  const { data: existing, error: readError } = await supabase.from("drops").select(DROP_COLUMNS).eq("id", input.id).single()
  if (readError) throw toDropMutationError(readError, "archiveDropRecord.read")
  const row = existing as unknown as DropRow

  if (row.archived_at) {
    const stock = await getDropStockSummary(row.id, readStringArray(row.sizes))
    return mapDropRow(row, stock)
  }

  const { data, error } = await supabase
    .from("drops")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: input.actor ?? null,
      archive_reason: input.reason ?? null,
      is_active: false,
      floating_enabled: false,
      is_closed: true,
    })
    .eq("id", input.id)
    .select(DROP_COLUMNS)
    .single()

  if (error) throw toDropMutationError(error, "archiveDropRecord")
  const archived = data as unknown as DropRow
  const stock = await getDropStockSummary(archived.id, readStringArray(archived.sizes))
  const drop = mapDropRow(archived, stock)
  await insertRevision({ drop, action: "archive", actor: input.actor })
  return drop
}

export async function unarchiveDropRecord(input: { id: string; actor?: string | null }) {
  const supabase = getDropClient()
  const { data: existing, error: readError } = await supabase.from("drops").select(DROP_COLUMNS).eq("id", input.id).single()
  if (readError) throw toDropMutationError(readError, "unarchiveDropRecord.read")
  const row = existing as unknown as DropRow

  if (!row.archived_at) {
    const stock = await getDropStockSummary(row.id, readStringArray(row.sizes))
    return mapDropRow(row, stock)
  }

  const { data, error } = await supabase
    .from("drops")
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
      is_active: false,
      floating_enabled: false,
      is_closed: false,
    })
    .eq("id", input.id)
    .select(DROP_COLUMNS)
    .single()

  if (error) throw toDropMutationError(error, "unarchiveDropRecord")
  const unarchived = data as unknown as DropRow
  const stock = await getDropStockSummary(unarchived.id, readStringArray(unarchived.sizes))
  const drop = mapDropRow(unarchived, stock)
  await insertRevision({ drop, action: "unarchive", actor: input.actor })
  return drop
}

export async function reserveDrop(input: {
  dropId: string
  idempotencyKey: string
  customerName: string
  phone: string
  selectedSize?: string | null
  selectedColor: string
}) {
  const supabase = getDropClient()
  const { data, error } = await supabase
    .rpc("create_drop_preorder", {
      p_drop_id: input.dropId,
      p_idempotency_key: input.idempotencyKey,
      p_customer_name: input.customerName,
      p_phone: input.phone,
      p_selected_size: input.selectedSize ?? null,
      p_selected_color: input.selectedColor,
    })
    .single()

  if (error) throw toDropMutationError(error, "reserveDrop")

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
  const supabase = getDropClient()
  const { data, error } = await supabase
    .rpc("cancel_drop_reservation", {
      p_reservation_id: input.reservationId,
      p_reason: input.reason ?? null,
    })
    .single()

  if (error) throw toDropMutationError(error, "cancelDropReservation")

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
  const supabase = getDropClient()
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

  if (error) throw toDropMutationError(error, "createOrderWithItems")
  if (typeof data !== "string") throw new Error("No se pudo crear el pedido")
  return { id: data }
}

export async function listDropReservations(): Promise<DropReservationListItem[]> {
  const supabase = getDropClient()
  const { data, error } = await supabase
    .from("drop_reservations")
    .select("id, created_at, drop_id, quantity, status, idempotency_key, customer_reference, customer_name, phone, selected_size, selected_color, cancelled_at, cancellation_reason, drops(name, slug)")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) throw toDropStorageUnavailableError(error, "listDropReservations")

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
      customerName: row.customer_name ? String(row.customer_name) : null,
      phone: row.phone ? String(row.phone) : null,
      selectedSize: row.selected_size ? String(row.selected_size) : null,
      selectedColor: row.selected_color ? String(row.selected_color) : null,
      idempotencyKey: String(row.idempotency_key ?? ""),
      cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
      cancellationReason: row.cancellation_reason ? String(row.cancellation_reason) : null,
      stockEffect: "Bajo pedido · no descuenta stock",
    }
  })
}

export async function listDropReservationsWithAvailability(): Promise<DropAdminModuleState<DropReservationListItem[]>> {
  try {
    return dropReadyState(await listDropReservations())
  } catch (error) {
    const availability = logDropCaughtError(error, "listDropReservationsWithAvailability")
    return dropUnavailableState(availability, [])
  }
}

export async function listDropOrders(): Promise<DropOrderListItem[]> {
  const supabase = getDropClient()
  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, order_id, drop_id, product_name, unit_price, selected_size, selected_color, qty, orders!inner(id, created_at, delivery_date, status, customer_name, phone), drops(name, slug)"
    )
    .eq("type", "drop")
    .order("id", { ascending: false })
    .limit(100)

  if (error) throw toDropStorageUnavailableError(error, "listDropOrders")

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

export async function listDropOrdersWithAvailability(): Promise<DropAdminModuleState<DropOrderListItem[]>> {
  try {
    return dropReadyState(await listDropOrders())
  } catch (error) {
    const availability = logDropCaughtError(error, "listDropOrdersWithAvailability")
    return dropUnavailableState(availability, [])
  }
}
