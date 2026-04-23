import { getAdminClient } from "@/lib/supabase/admin"
import { buildCatalogDocument, parseCatalogDocument } from "@/src/data/catalog-document"
import {
  buildProductsFromFlavorRecords,
  getFlavorFactsFromProducts,
  getFlavorsFromProducts,
  getProductBySlugFromProducts,
  getProductsByCategoryFromProducts,
  seedFlavorRecords,
  sortFlavorRecords,
  type EditableCatalogDocument,
  type EditableFlavorRecord,
} from "@/src/data/products"

const CATALOG_BUCKET = "saycheese-admin"
const CATALOG_OBJECT_PATH = "catalog/tartas.json"
const STORAGE_READ_RETRY_COUNT = 4
const STORAGE_READ_RETRY_DELAY_MS = 250

let cachedCatalogDocument: EditableCatalogDocument | null = null

function cloneFlavorRecords(records: EditableFlavorRecord[]) {
  return records.map((record) => ({ ...record }))
}

function cloneCatalogDocument(document: EditableCatalogDocument): EditableCatalogDocument {
  return {
    ...document,
    flavors: cloneFlavorRecords(document.flavors),
  }
}

function getCachedCatalogDocument() {
  return cachedCatalogDocument ? cloneCatalogDocument(cachedCatalogDocument) : null
}

function rememberCatalogDocument(document: EditableCatalogDocument) {
  cachedCatalogDocument = cloneCatalogDocument(document)
}

function isMissingCatalogError(message: string) {
  return /not found|Object not found/i.test(message)
}

function waitForStorage(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function ensureCatalogBucket() {
  const supabase = getAdminClient()
  const { data: bucket, error } = await supabase.storage.getBucket(CATALOG_BUCKET)

  if (bucket) {
    return supabase
  }

  if (error && !/not found/i.test(error.message)) {
    throw new Error(error.message)
  }

  const { error: createError } = await supabase.storage.createBucket(CATALOG_BUCKET, {
    public: false,
    fileSizeLimit: 1024 * 1024,
    allowedMimeTypes: ["application/json"],
  })

  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(createError.message)
  }

  return supabase
}

type CatalogDownloadResult =
  | { kind: "ok"; document: EditableCatalogDocument }
  | { kind: "missing" }
  | { kind: "retryable"; error: Error }

async function downloadCatalogDocument(
  supabase: Awaited<ReturnType<typeof ensureCatalogBucket>>
): Promise<CatalogDownloadResult> {
  const { data, error } = await supabase.storage.from(CATALOG_BUCKET).download(CATALOG_OBJECT_PATH)

  if (error) {
    if (isMissingCatalogError(error.message)) {
      return { kind: "missing" }
    }

    return { kind: "retryable", error: new Error(error.message) }
  }

  const raw = await data.text()
  const parsed = parseCatalogDocument(raw)

  if (!parsed) {
    return { kind: "retryable", error: new Error("Documento de catálogo inválido") }
  }

  return {
    kind: "ok",
    document: parsed,
  }
}

async function waitForCatalogVisibility(
  supabase: Awaited<ReturnType<typeof ensureCatalogBucket>>,
  updatedAt: string
) {
  for (let attempt = 0; attempt < STORAGE_READ_RETRY_COUNT; attempt += 1) {
    const result = await downloadCatalogDocument(supabase)

    if (result.kind === "ok" && result.document.updatedAt >= updatedAt) {
      rememberCatalogDocument(result.document)
      return result.document
    }

    if (attempt < STORAGE_READ_RETRY_COUNT - 1) {
      await waitForStorage(STORAGE_READ_RETRY_DELAY_MS)
    }
  }

  return null
}

async function persistCatalogDocument(
  supabase: Awaited<ReturnType<typeof ensureCatalogBucket>>,
  records: EditableFlavorRecord[]
) {
  const document = buildCatalogDocument(records)
  const body = JSON.stringify(document, null, 2)

  const { error } = await supabase.storage
    .from(CATALOG_BUCKET)
    .upload(CATALOG_OBJECT_PATH, body, {
      upsert: true,
      contentType: "application/json",
      cacheControl: "0",
    })

  if (error) {
    throw new Error(error.message)
  }

  rememberCatalogDocument(document)

  const visibleDocument = await waitForCatalogVisibility(supabase, document.updatedAt)
  if (visibleDocument && visibleDocument.updatedAt >= document.updatedAt) {
    return cloneFlavorRecords(visibleDocument.flavors)
  }

  return cloneFlavorRecords(document.flavors)
}

async function uploadCatalogDocument(records: EditableFlavorRecord[]) {
  const supabase = await ensureCatalogBucket()
  return persistCatalogDocument(supabase, records)
}

async function readCatalogDocumentFromStorage() {
  const supabase = await ensureCatalogBucket()

  try {
    for (let attempt = 0; attempt < STORAGE_READ_RETRY_COUNT; attempt += 1) {
      const result = await downloadCatalogDocument(supabase)

      if (result.kind === "ok") {
        rememberCatalogDocument(result.document)
        return cloneFlavorRecords(result.document.flavors)
      }

      if (result.kind === "missing") {
        return persistCatalogDocument(supabase, seedFlavorRecords)
      }

      if (attempt < STORAGE_READ_RETRY_COUNT - 1) {
        await waitForStorage(STORAGE_READ_RETRY_DELAY_MS)
        continue
      }

      throw result.error
    }

    return persistCatalogDocument(supabase, seedFlavorRecords)
  } catch (error) {
    const cached = getCachedCatalogDocument()
    if (cached) {
      return cached.flavors
    }

    const seeded = await persistCatalogDocument(supabase, seedFlavorRecords)
    return seeded
  }
}

export async function getCatalogFlavorRecords(): Promise<EditableFlavorRecord[]> {
  try {
    return await readCatalogDocumentFromStorage()
  } catch (error) {
    console.error("No se pudo leer el catálogo persistido, usando seed local", error)
    return cloneFlavorRecords(seedFlavorRecords)
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

export async function saveCatalogFlavorRecords(records: EditableFlavorRecord[]) {
  return uploadCatalogDocument(records)
}
