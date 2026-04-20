import "server-only"

import { z } from "zod"

import { getAdminClient } from "@/lib/supabase/admin"
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

const flavorRecordSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  allergens: z.string().default(""),
  tartaImage: z.string().default(""),
  cajitaImage: z.string().default(""),
  tartaPrice: z.number().positive(),
  cajitaPrice: z.number().positive(),
  position: z.number().int().nonnegative(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

const catalogDocumentSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  flavors: z.array(flavorRecordSchema),
})

function cloneFlavorRecords(records: EditableFlavorRecord[]) {
  return records.map((record) => ({ ...record }))
}

function buildCatalogDocument(records: EditableFlavorRecord[]): EditableCatalogDocument {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    flavors: sortFlavorRecords(records).map((record, index) => ({
      ...record,
      position: index,
    })),
  }
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

async function uploadCatalogDocument(records: EditableFlavorRecord[]) {
  const supabase = await ensureCatalogBucket()
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

  return document.flavors
}

async function readCatalogDocumentFromStorage() {
  const supabase = await ensureCatalogBucket()
  const { data, error } = await supabase.storage.from(CATALOG_BUCKET).download(CATALOG_OBJECT_PATH)

  if (error) {
    if (/not found/i.test(error.message) || /Object not found/i.test(error.message)) {
      const seeded = await uploadCatalogDocument(seedFlavorRecords)
      return seeded
    }

    throw new Error(error.message)
  }

  const raw = await data.text()
  const parsed = catalogDocumentSchema.safeParse(JSON.parse(raw))

  if (!parsed.success) {
    const seeded = await uploadCatalogDocument(seedFlavorRecords)
    return seeded
  }

  if (!parsed.data.flavors.length) {
    const seeded = await uploadCatalogDocument(seedFlavorRecords)
    return seeded
  }

  return sortFlavorRecords(parsed.data.flavors)
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
