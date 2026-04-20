"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdminUser } from "@/lib/admin-auth"
import { getCatalogFlavorRecords, saveCatalogFlavorRecords } from "@/src/data/products-store"
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

function revalidateCatalogRoutes(slug: string) {
  revalidatePath("/")
  revalidatePath("/productos")
  revalidatePath("/admin/edicion")
  revalidatePath(`/producto/tarta-${slug}`)
  revalidatePath(`/producto/cajita-${slug}`)
}

function ok(flavors: EditableFlavorRecord[]) {
  return { ok: true as const, flavors }
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo guardar el catálogo"
  return { ok: false as const, error: message }
}

export async function createCakeFlavor(payload: z.infer<typeof createFlavorSchema>) {
  try {
    await requireAdminUser()
    const parsed = createFlavorSchema.parse(payload)
    const current = await getCatalogFlavorRecords()
    const slug = slugifyFlavorName(parsed.name)

    if (!slug) {
      throw new Error("No se pudo generar un identificador válido para ese sabor")
    }

    if (current.some((flavor) => flavor.slug === slug)) {
      throw new Error("Ya existe un sabor con ese nombre")
    }

    const next = [
      ...current,
      {
        ...parsed,
        slug,
        position: current.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    const saved = await saveCatalogFlavorRecords(next)
    revalidateCatalogRoutes(slug)
    return ok(saved)
  } catch (error) {
    return fail(error)
  }
}

export async function updateCakeFlavor(payload: z.infer<typeof updateFlavorSchema>) {
  try {
    await requireAdminUser()
    const parsed = updateFlavorSchema.parse(payload)
    const current = await getCatalogFlavorRecords()
    const target = current.find((flavor) => flavor.slug === parsed.slug)

    if (!target) {
      throw new Error("No se encontró el sabor a editar")
    }

    const next = current.map((flavor) =>
      flavor.slug === parsed.slug
        ? {
            ...flavor,
            ...parsed,
            slug: flavor.slug,
            updatedAt: new Date().toISOString(),
          }
        : flavor
    )

    const saved = await saveCatalogFlavorRecords(next)
    revalidateCatalogRoutes(parsed.slug)
    return ok(saved)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteCakeFlavor(payload: z.infer<typeof deleteFlavorSchema>) {
  try {
    await requireAdminUser()
    const parsed = deleteFlavorSchema.parse(payload)
    const current = await getCatalogFlavorRecords()

    if (!current.some((flavor) => flavor.slug === parsed.slug)) {
      throw new Error("No se encontró el sabor a borrar")
    }

    const next = current
      .filter((flavor) => flavor.slug !== parsed.slug)
      .map((flavor, index) => ({ ...flavor, position: index }))

    const saved = await saveCatalogFlavorRecords(next)
    revalidateCatalogRoutes(parsed.slug)
    return ok(saved)
  } catch (error) {
    return fail(error)
  }
}
