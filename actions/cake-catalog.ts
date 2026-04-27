"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdminUser } from "@/lib/admin-auth"
import {
  createCakeFlavorRecordInDb,
  getArchivedCatalogFlavorRecords,
  restoreCakeFlavorRecordInDb,
  softDeleteCakeFlavorRecordInDb,
  updateCakeFlavorRecordInDb,
} from "@/src/data/products-store"
import { slugifyFlavorName, type EditableFlavorRecord } from "@/src/data/products"

const baseFlavorSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80, "Máximo 80 caracteres"),
  description: z.string().trim().max(500, "Máximo 500 caracteres").default(""),
  allergens: z.string().trim().max(250, "Máximo 250 caracteres").default(""),
  tartaImage: z.string().trim().max(500, "Máximo 500 caracteres").default(""),
  cajitaImage: z.string().trim().max(500, "Máximo 500 caracteres").default(""),
  tartaPrice: z.coerce.number().positive("El precio grande debe ser mayor que 0"),
  cajitaPrice: z.coerce.number().positive("El precio cajita debe ser mayor que 0"),
})

const createFlavorSchema = baseFlavorSchema

const updateFlavorSchema = baseFlavorSchema.extend({
  slug: z.string().min(1),
})

const deleteFlavorSchema = z.object({
  slug: z.string().min(1),
})

const restoreFlavorSchema = z.object({
  slug: z.string().min(1),
})

type CakeFlavorFormPayload = Omit<z.input<typeof baseFlavorSchema>, "tartaPrice" | "cajitaPrice"> & {
  tartaPrice: string | number
  cajitaPrice: string | number
}

type UpdateCakeFlavorFormPayload = CakeFlavorFormPayload & {
  slug: string
}

function revalidateCatalogRoutes(slug: string) {
  revalidatePath("/")
  revalidatePath("/productos")
  revalidatePath("/admin/edicion")
  revalidatePath(`/producto/tarta-${slug}`)
  revalidatePath(`/producto/cajita-${slug}`)
}

type CatalogActionResult =
  | {
      ok: true
      flavors: EditableFlavorRecord[]
      archivedFlavors?: EditableFlavorRecord[]
      selectedSlug?: string
    }
  | {
      ok: false
      error: string
    }

function ok(
  flavors: EditableFlavorRecord[],
  selectedSlug?: string,
  archivedFlavors?: EditableFlavorRecord[]
): CatalogActionResult {
  return {
    ok: true as const,
    flavors,
    ...(archivedFlavors ? { archivedFlavors } : {}),
    ...(selectedSlug ? { selectedSlug } : {}),
  }
}

async function getArchivedForResponse() {
  return getArchivedCatalogFlavorRecords()
}

function fail(error: unknown): CatalogActionResult {
  const message = error instanceof Error ? error.message : "No se pudo guardar el catálogo"
  return { ok: false as const, error: message }
}

export async function createCakeFlavor(payload: CakeFlavorFormPayload) {
  try {
    const { user } = await requireAdminUser()
    const parsed = createFlavorSchema.parse(payload)
    const slug = slugifyFlavorName(parsed.name)

    if (!slug) {
      throw new Error("No se pudo generar un identificador válido para ese sabor")
    }

    const saved = await createCakeFlavorRecordInDb(
      {
        ...parsed,
        slug,
      },
      user.email ?? user.id
    )
    revalidateCatalogRoutes(slug)
    return ok(saved, slug)
  } catch (error) {
    return fail(error)
  }
}

export async function updateCakeFlavor(payload: UpdateCakeFlavorFormPayload) {
  try {
    const { user } = await requireAdminUser()
    const parsed = updateFlavorSchema.parse(payload)
    const saved = await updateCakeFlavorRecordInDb(
      parsed.slug,
      {
        name: parsed.name,
        description: parsed.description,
        allergens: parsed.allergens,
        tartaImage: parsed.tartaImage,
        cajitaImage: parsed.cajitaImage,
        tartaPrice: parsed.tartaPrice,
        cajitaPrice: parsed.cajitaPrice,
      },
      user.email ?? user.id
    )
    revalidateCatalogRoutes(parsed.slug)
    return ok(saved, parsed.slug)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteCakeFlavor(payload: z.infer<typeof deleteFlavorSchema>) {
  try {
    const { user } = await requireAdminUser()
    const parsed = deleteFlavorSchema.parse(payload)
    const saved = await softDeleteCakeFlavorRecordInDb(parsed.slug, user.email ?? user.id)
    const archived = await getArchivedForResponse()
    revalidateCatalogRoutes(parsed.slug)
    return ok(saved, saved[0]?.slug, archived)
  } catch (error) {
    return fail(error)
  }
}

export async function restoreCakeFlavor(payload: z.infer<typeof restoreFlavorSchema>) {
  try {
    const { user } = await requireAdminUser()
    const parsed = restoreFlavorSchema.parse(payload)
    const saved = await restoreCakeFlavorRecordInDb(parsed.slug, user.email ?? user.id)
    const archived = await getArchivedForResponse()
    revalidateCatalogRoutes(parsed.slug)
    return ok(saved, parsed.slug, archived)
  } catch (error) {
    return fail(error)
  }
}
