import { z } from "zod"

import { sortFlavorRecords, type EditableCatalogDocument, type EditableFlavorRecord } from "@/src/data/products"

export const flavorRecordSchema = z.object({
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

export function buildCatalogDocument(
  records: EditableFlavorRecord[],
  updatedAt = new Date().toISOString()
): EditableCatalogDocument {
  return {
    version: 1,
    updatedAt,
    flavors: sortFlavorRecords(records).map((record, index) => ({
      ...record,
      position: index,
    })),
  }
}

export function parseCatalogDocument(raw: string): EditableCatalogDocument | null {
  try {
    const parsed = catalogDocumentSchema.safeParse(JSON.parse(raw))

    if (!parsed.success || !parsed.data.flavors.length) {
      return null
    }

    return buildCatalogDocument(parsed.data.flavors, parsed.data.updatedAt)
  } catch {
    return null
  }
}
