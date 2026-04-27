import { getAdminClient } from "@/lib/supabase/admin"
import {
  buildProductsFromFlavorRecords,
  getFlavorFactsFromProducts,
  getFlavorsFromProducts,
  getProductBySlugFromProducts,
  getProductsByCategoryFromProducts,
  seedFlavorRecords,
  sortFlavorRecords,
  type EditableFlavorRecord,
} from "@/src/data/products"

export type CakeFlavorAction = "create" | "update" | "delete" | "restore" | "import_legacy_json"

export type CakeFlavorRow = {
  id: string
  slug: string
  name: string
  description: string | null
  allergens: string | null
  price_large: number | string | null
  price_box: number | string | null
  image_large_path: string | null
  image_large_url: string | null
  image_box_path: string | null
  image_box_url: string | null
  display_order: number | null
  is_active: boolean
  deleted_at: string | null
  created_at: string | null
  updated_at: string | null
}

type CakeFlavorInsert = {
  slug: string
  name: string
  description: string
  allergens: string
  price_large: number
  price_box: number
  image_large_url: string
  image_box_url: string
  display_order: number
  is_active: boolean
  deleted_at: string | null
}

type CakeFlavorUpdate = Partial<Omit<CakeFlavorInsert, "slug">>

export type CakeFlavorRevisionInsert = {
  flavor_id: string | null
  action: CakeFlavorAction
  slug: string | null
  snapshot: Record<string, unknown>
  actor: string | null
}

export type CakeFlavorPersistence = {
  listActiveRows(): Promise<CakeFlavorRow[]>
  listArchivedRows(): Promise<CakeFlavorRow[]>
  findAnyRowBySlug(slug: string): Promise<CakeFlavorRow | null>
  findActiveRowBySlug(slug: string): Promise<CakeFlavorRow | null>
  getMaxActiveDisplayOrder(): Promise<number>
  insertRow(row: CakeFlavorInsert): Promise<CakeFlavorRow>
  updateRow(id: string, updates: CakeFlavorUpdate): Promise<CakeFlavorRow>
  insertRevision(row: CakeFlavorRevisionInsert): Promise<void>
  setDisplayOrder(id: string, displayOrder: number): Promise<void>
}

const CAKE_FLAVOR_COLUMNS = [
  "id",
  "slug",
  "name",
  "description",
  "allergens",
  "price_large",
  "price_box",
  "image_large_path",
  "image_large_url",
  "image_box_path",
  "image_box_url",
  "display_order",
  "is_active",
  "deleted_at",
  "created_at",
  "updated_at",
].join(",")

let cachedFlavorRecords: EditableFlavorRecord[] | null = null

function cloneFlavorRecords(records: EditableFlavorRecord[]) {
  return records.map((record) => ({ ...record }))
}

function numberFromDb(value: number | string | null, fallback: number) {
  if (value === null) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido"
}

function canUseTestOnlySeedFallback(error: unknown) {
  return (
    process.env.CATALOG_TEST_READONLY_SEED_FALLBACK === "1" &&
    /Faltan variables SUPABASE|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/i.test(messageFromError(error))
  )
}

export function mapCakeFlavorRowToEditableFlavorRecord(row: CakeFlavorRow): EditableFlavorRecord {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    allergens: row.allergens ?? "",
    tartaImage: row.image_large_url ?? row.image_large_path ?? "",
    cajitaImage: row.image_box_url ?? row.image_box_path ?? "",
    tartaPrice: numberFromDb(row.price_large, 35),
    cajitaPrice: numberFromDb(row.price_box, 12),
    position: row.display_order ?? 0,
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
  }
}

export function buildFlavorRevisionSnapshot(
  record: EditableFlavorRecord,
  state: { isActive?: boolean; deletedAt?: string | null } = {}
) {
  return {
    slug: record.slug,
    name: record.name,
    description: record.description,
    allergens: record.allergens,
    tartaImage: record.tartaImage,
    cajitaImage: record.cajitaImage,
    tartaPrice: record.tartaPrice,
    cajitaPrice: record.cajitaPrice,
    position: record.position,
    isActive: state.isActive ?? true,
    deletedAt: state.deletedAt ?? null,
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
  }
}

function rowInsertFromRecord(record: EditableFlavorRecord, displayOrder: number): CakeFlavorInsert {
  return {
    slug: record.slug,
    name: record.name,
    description: record.description,
    allergens: record.allergens,
    price_large: record.tartaPrice,
    price_box: record.cajitaPrice,
    image_large_url: record.tartaImage,
    image_box_url: record.cajitaImage,
    display_order: displayOrder,
    is_active: true,
    deleted_at: null,
  }
}

function rowUpdateFromRecord(record: EditableFlavorRecord): CakeFlavorUpdate {
  return {
    name: record.name,
    description: record.description,
    allergens: record.allergens,
    price_large: record.tartaPrice,
    price_box: record.cajitaPrice,
    image_large_url: record.tartaImage,
    image_box_url: record.cajitaImage,
  }
}

async function insertRevision(
  persistence: CakeFlavorPersistence,
  action: CakeFlavorAction,
  row: CakeFlavorRow,
  actor?: string | null
) {
  const record = mapCakeFlavorRowToEditableFlavorRecord(row)
  await persistence.insertRevision({
    flavor_id: row.id,
    action,
    slug: row.slug,
    snapshot: buildFlavorRevisionSnapshot(record, { isActive: row.is_active, deletedAt: row.deleted_at }),
    actor: actor ?? null,
  })
}

async function listNormalizedRecords(persistence: CakeFlavorPersistence) {
  return sortFlavorRecords((await persistence.listActiveRows()).map(mapCakeFlavorRowToEditableFlavorRecord)).map(
    (record, index) => ({
      ...record,
      position: index,
    })
  )
}

async function reindexActiveRows(persistence: CakeFlavorPersistence) {
  const rows = await persistence.listActiveRows()
  const sorted = sortFlavorRecords(rows.map(mapCakeFlavorRowToEditableFlavorRecord))

  await Promise.all(
    sorted.map(async (record, index) => {
      const row = rows.find((candidate) => candidate.slug === record.slug)
      if (row && row.display_order !== index) {
        await persistence.setDisplayOrder(row.id, index)
      }
    })
  )
}

class SupabaseCakeFlavorPersistence implements CakeFlavorPersistence {
  constructor(private readonly supabase = getAdminClient()) {}

  async listActiveRows() {
    const { data, error } = await this.supabase
      .from("cake_flavors")
      .select(CAKE_FLAVOR_COLUMNS)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true })

    if (error) throw new Error(error.message)
    return (data ?? []) as unknown as CakeFlavorRow[]
  }

  async listArchivedRows() {
    const { data, error } = await this.supabase
      .from("cake_flavors")
      .select(CAKE_FLAVOR_COLUMNS)
      .eq("is_active", false)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .order("name", { ascending: true })

    if (error) throw new Error(error.message)
    return (data ?? []) as unknown as CakeFlavorRow[]
  }

  async findAnyRowBySlug(slug: string) {
    const { data, error } = await this.supabase
      .from("cake_flavors")
      .select(CAKE_FLAVOR_COLUMNS)
      .eq("slug", slug)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return (data as unknown as CakeFlavorRow | null) ?? null
  }

  async findActiveRowBySlug(slug: string) {
    const { data, error } = await this.supabase
      .from("cake_flavors")
      .select(CAKE_FLAVOR_COLUMNS)
      .eq("slug", slug)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return (data as unknown as CakeFlavorRow | null) ?? null
  }

  async getMaxActiveDisplayOrder() {
    const { data, error } = await this.supabase
      .from("cake_flavors")
      .select("display_order")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return typeof data?.display_order === "number" ? data.display_order : -1
  }

  async insertRow(row: CakeFlavorInsert) {
    const { data, error } = await this.supabase
      .from("cake_flavors")
      .insert(row)
      .select(CAKE_FLAVOR_COLUMNS)
      .single()

    if (error) throw new Error(error.message)
    return data as unknown as CakeFlavorRow
  }

  async updateRow(id: string, updates: CakeFlavorUpdate) {
    const { data, error } = await this.supabase
      .from("cake_flavors")
      .update(updates)
      .eq("id", id)
      .select(CAKE_FLAVOR_COLUMNS)
      .single()

    if (error) throw new Error(error.message)
    return data as unknown as CakeFlavorRow
  }

  async insertRevision(row: CakeFlavorRevisionInsert) {
    const { error } = await this.supabase.from("cake_flavor_revisions").insert(row)
    if (error) throw new Error(error.message)
  }

  async setDisplayOrder(id: string, displayOrder: number) {
    const { error } = await this.supabase.from("cake_flavors").update({ display_order: displayOrder }).eq("id", id)
    if (error) throw new Error(error.message)
  }
}

function createDefaultPersistence() {
  return new SupabaseCakeFlavorPersistence()
}

export async function getCatalogFlavorRecordsFromPersistence(persistence: CakeFlavorPersistence) {
  const records = await listNormalizedRecords(persistence)

  if (!records.length) {
    throw new Error("El catálogo de tartas en Postgres está vacío. Ejecuta la importación legacy antes de desplegar.")
  }

  return records
}

export async function getArchivedCatalogFlavorRecordsFromPersistence(persistence: CakeFlavorPersistence) {
  return (await persistence.listArchivedRows()).map(mapCakeFlavorRowToEditableFlavorRecord)
}

export async function createCakeFlavorRecordInDb(
  record: Omit<EditableFlavorRecord, "position" | "createdAt" | "updatedAt">,
  actor?: string | null,
  persistence: CakeFlavorPersistence = createDefaultPersistence()
) {
  const existing = await persistence.findAnyRowBySlug(record.slug)

  if (existing) {
    throw new Error(
      existing.deleted_at || !existing.is_active
        ? "Ese sabor ya existe archivado. Restáuralo desde Sabores archivados antes de crear uno nuevo con el mismo identificador."
        : "Ya existe un sabor con ese nombre"
    )
  }

  const displayOrder = (await persistence.getMaxActiveDisplayOrder()) + 1
  const inserted = await persistence.insertRow(rowInsertFromRecord({ ...record, position: displayOrder }, displayOrder))
  await insertRevision(persistence, "create", inserted, actor)
  await reindexActiveRows(persistence)
  return listNormalizedRecords(persistence)
}

export async function updateCakeFlavorRecordInDb(
  slug: string,
  updates: Omit<EditableFlavorRecord, "slug" | "position" | "createdAt" | "updatedAt">,
  actor?: string | null,
  persistence: CakeFlavorPersistence = createDefaultPersistence()
) {
  const current = await persistence.findActiveRowBySlug(slug)

  if (!current) {
    throw new Error("No se encontró el sabor activo a editar")
  }

  const currentRecord = mapCakeFlavorRowToEditableFlavorRecord(current)
  const updated = await persistence.updateRow(
    current.id,
    rowUpdateFromRecord({
      ...currentRecord,
      ...updates,
      slug,
    })
  )

  await insertRevision(persistence, "update", updated, actor)
  return listNormalizedRecords(persistence)
}

export async function softDeleteCakeFlavorRecordInDb(
  slug: string,
  actor?: string | null,
  persistence: CakeFlavorPersistence = createDefaultPersistence()
) {
  const current = await persistence.findActiveRowBySlug(slug)

  if (!current) {
    throw new Error("No se encontró el sabor activo a borrar")
  }

  const deleted = await persistence.updateRow(current.id, {
    is_active: false,
    deleted_at: new Date().toISOString(),
  })

  await insertRevision(persistence, "delete", deleted, actor)
  await reindexActiveRows(persistence)
  return listNormalizedRecords(persistence)
}

export async function restoreCakeFlavorRecordInDb(
  slug: string,
  actor?: string | null,
  persistence: CakeFlavorPersistence = createDefaultPersistence()
) {
  const current = await persistence.findAnyRowBySlug(slug)

  if (!current) {
    throw new Error("No se encontró el sabor archivado a restaurar")
  }

  if (current.is_active && !current.deleted_at) {
    throw new Error("Ese sabor ya está activo")
  }

  const displayOrder = (await persistence.getMaxActiveDisplayOrder()) + 1
  const restored = await persistence.updateRow(current.id, {
    is_active: true,
    deleted_at: null,
    display_order: displayOrder,
  })

  await insertRevision(persistence, "restore", restored, actor)
  await reindexActiveRows(persistence)
  return listNormalizedRecords(persistence)
}

export async function getCatalogFlavorRecords(): Promise<EditableFlavorRecord[]> {
  try {
    const records = await getCatalogFlavorRecordsFromPersistence(createDefaultPersistence())
    cachedFlavorRecords = cloneFlavorRecords(records)
    return records
  } catch (error) {
    if (cachedFlavorRecords) {
      console.error("No se pudo leer el catálogo desde Postgres, usando caché de solo lectura", error)
      return cloneFlavorRecords(cachedFlavorRecords)
    }

    if (canUseTestOnlySeedFallback(error)) {
      return cloneFlavorRecords(seedFlavorRecords)
    }

    throw new Error(`No se pudo leer el catálogo desde Postgres: ${messageFromError(error)}`)
  }
}

export async function getArchivedCatalogFlavorRecords(): Promise<EditableFlavorRecord[]> {
  try {
    return await getArchivedCatalogFlavorRecordsFromPersistence(createDefaultPersistence())
  } catch (error) {
    throw new Error(`No se pudieron leer los sabores archivados desde Postgres: ${messageFromError(error)}`)
  }
}

export async function getCatalogProducts() {
  return buildProductsFromFlavorRecords(await getCatalogFlavorRecords())
}

export async function getCatalogFlavors() {
  return getFlavorsFromProducts(await getCatalogProducts())
}

export async function getCatalogProductBySlug(slug: string) {
  return getProductBySlugFromProducts(await getCatalogProducts(), slug)
}

export async function getCatalogProductsByCategory(category: string) {
  return getProductsByCategoryFromProducts(await getCatalogProducts(), category)
}

export async function getCatalogFlavorFacts(category: string) {
  return getFlavorFactsFromProducts(await getCatalogProducts(), category)
}

export async function saveCatalogFlavorRecords() {
  throw new Error("La escritura del catálogo por JSON legacy está desactivada; usa cake_flavors en Postgres")
}
