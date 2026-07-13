"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdminUser } from "@/lib/admin-auth"
import { normalizePhone } from "@/lib/phone"
import {
  DEFAULT_DROP_LAUNCH_LOCAL,
  DEFAULT_DROP_PREORDER_LIMIT,
  DEFAULT_DROP_PREORDER_CTA_TEXT,
  DROP_LAUNCH_TIME_ZONE,
  MAX_DROP_PREORDER_CTA_LENGTH,
  localDateTimeToUtcIso,
  normalizeDropSizeStock,
  normalizeDropPreorderCtaText,
  parseDropImageList,
  parseDropOptionList,
} from "@/src/data/drops"
import { DropArchiveSizeStockMigrationRequiredError, DropCtaMigrationRequiredError, DropStorageUnavailableError } from "@/src/data/drop-storage-status"
import {
  archiveDropRecord,
  cancelDropReservation,
  createDropRecord,
  listAdminDrops,
  reserveDrop,
  unarchiveDropRecord,
  updateDropRecord,
} from "@/src/data/drops-store"
import { slugifyFlavorName } from "@/src/data/products"

const dropFormSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().max(80).optional(),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  description: z.string().trim().max(2000).default(""),
  price: z.coerce.number().min(0, "El precio no puede ser negativo"),
  imageUrls: z.union([z.string(), z.array(z.string())]).default(""),
  colors: z.union([z.string(), z.array(z.string())]).default(""),
  sizeStockEnabled: z.boolean().default(false),
  sizes: z.union([z.string(), z.array(z.string())]).default(""),
  sizeStock: z.array(z.object({
    size: z.string().trim().min(1),
    stockTotal: z.coerce.number().int().min(0),
    position: z.coerce.number().int().min(0),
  })).default([]),
  stockTotal: z.coerce.number().int().min(0, "El stock debe ser entero y no negativo"),
  launchAtLocal: z.string().trim().min(1, "La fecha de lanzamiento es obligatoria").default(DEFAULT_DROP_LAUNCH_LOCAL),
  launchTimezone: z.string().trim().default(DROP_LAUNCH_TIME_ZONE),
  isActive: z.boolean().default(false),
  floatingEnabled: z.boolean().default(false),
  floatingMessage: z.string().max(600, "El mensaje puede tener como máximo 600 caracteres").default(""),
  preorderCtaText: z.string().max(MAX_DROP_PREORDER_CTA_LENGTH, `El CTA puede tener como máximo ${MAX_DROP_PREORDER_CTA_LENGTH} caracteres`).default(DEFAULT_DROP_PREORDER_CTA_TEXT),
  preorderLimit: z.coerce.number().int().min(0, "El límite de preventa no puede ser negativo").max(1_000_000).default(DEFAULT_DROP_PREORDER_LIMIT),
  isClosed: z.boolean().default(false),
})

const reserveDropSchema = z.object({
  dropId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(160),
  customerName: z.string().trim().min(3, "Escribe tu nombre y apellidos").max(160),
  phone: z.string().trim().max(40).refine((value) => normalizePhone(value).length >= 6, "Escribe un teléfono válido"),
  selectedSize: z.string().trim().max(80).optional().nullable(),
  selectedColor: z.string().trim().min(1, "Selecciona un color").max(80),
})

const cancelReservationSchema = z.object({
  reservationId: z.string().uuid(),
  reason: z.string().trim().max(300).optional(),
})

const archiveDropSchema = z.object({
  dropId: z.string().uuid(),
  reason: z.string().trim().max(300).optional(),
})

const unarchiveDropSchema = z.object({
  dropId: z.string().uuid(),
})

function normalizeDropForm(input: z.input<typeof dropFormSchema>) {
  const parsed = dropFormSchema.parse(input)
  const slug = parsed.slug?.trim() ? slugifyFlavorName(parsed.slug) : slugifyFlavorName(parsed.name)
  const imageUrls = parseDropImageList(parsed.imageUrls)
  const colors = parseDropOptionList(parsed.colors)
  const sizeStockEnabled = parsed.sizeStockEnabled
  const sizes = parseDropOptionList(parsed.sizes)
  const sizeStock = normalizeDropSizeStock(sizes, parsed.sizeStock).map((entry) => ({
    ...entry,
    stockTotal: sizeStockEnabled ? entry.stockTotal : 0,
  }))
  const preorderCtaText = normalizeDropPreorderCtaText(parsed.preorderCtaText)

  if (!slug) {
    throw new Error("No se pudo generar el identificador del drop")
  }

  if (parsed.isActive && !colors.length) {
    throw new Error("Antes de activar un drop debes configurar al menos un color")
  }

  const sizeStockBySize = new Set(sizeStock.map((entry) => entry.size.toLocaleLowerCase("es")))
  const sizeStockTotal = sizeStock.reduce((sum, entry) => sum + entry.stockTotal, 0)
  if (parsed.isActive && sizeStockEnabled && (!sizeStock.length || sizes.some((size) => !sizeStockBySize.has(size.toLocaleLowerCase("es"))) || sizeStockTotal <= 0)) {
    throw new Error("Antes de publicar con tallas debes configurar al menos una talla con stock")
  }

  if (parsed.isActive && imageUrls.length === 0) {
    throw new Error("Antes de publicar un drop debes subir una imagen principal")
  }

  if (parsed.floatingEnabled && parsed.preorderCtaText.trim().length === 0) {
    throw new Error("El texto del botón de preventa es obligatorio para mostrar el flotante")
  }

  return {
    id: parsed.id,
    slug,
    name: parsed.name,
    description: parsed.description,
    price: parsed.price,
    imageUrls,
    colors,
    sizes,
    sizeStock,
    stockTotal: sizeStockEnabled ? sizeStockTotal : parsed.stockTotal,
    sizeStockEnabled,
    launchAt: localDateTimeToUtcIso(parsed.launchAtLocal, parsed.launchTimezone || DROP_LAUNCH_TIME_ZONE),
    launchTimezone: parsed.launchTimezone || DROP_LAUNCH_TIME_ZONE,
    isActive: parsed.isActive,
    floatingEnabled: parsed.floatingEnabled,
    floatingMessage: parsed.floatingMessage,
    preorderCtaText,
    preorderLimit: parsed.preorderLimit,
    isClosed: parsed.isClosed,
  }
}

function revalidateDropSurfaces(slug?: string) {
  revalidatePath("/")
  revalidatePath("/drops")
  revalidatePath("/admin/drops")
  revalidatePath("/admin/camisetas")
  if (slug) revalidatePath(`/drops/${slug}`)
}

function publicDropErrorMessage(error: unknown) {
  if (error instanceof DropStorageUnavailableError) {
    return "La preventa no está disponible temporalmente."
  }

  const message = error instanceof Error ? error.message : String(error)

  if (/drop_sold_out/i.test(message)) return "Agotado"
  if (/preorder_sold_out/i.test(message)) return "La preventa está agotada."
  if (/drop_archived/i.test(message)) return "Este drop ya no está disponible."
  if (/invalid_preorder_customer_name/i.test(message)) return "Escribe tu nombre y apellidos."
  if (/invalid_preorder_phone/i.test(message)) return "Escribe un teléfono válido."
  if (/invalid_drop_size/i.test(message)) return "Selecciona una talla válida."
  if (/invalid_drop_color/i.test(message)) return "Selecciona un color válido."
  if (/reservation_cancelled_idempotency_key/i.test(message)) return "La preventa anterior estaba cancelada. Vamos a intentarlo de nuevo."
  if (/drop_not_prelaunch|drop_not_live/i.test(message)) return "Esta acción ya no está disponible para este drop."
  if (/missing_idempotency_key/i.test(message)) return "No se pudo confirmar la reserva. Inténtalo de nuevo."

  return "No se pudo completar la operación. Inténtalo de nuevo."
}

export async function saveDrop(payload: z.input<typeof dropFormSchema>) {
  try {
    const { user } = await requireAdminUser()
    const normalized = normalizeDropForm(payload)
    const { id, ...dropInput } = normalized
    const saved = id
      ? await updateDropRecord(id, dropInput, user.email ?? user.id)
      : await createDropRecord(dropInput, user.email ?? user.id)
    const drops = await listAdminDrops()

    revalidateDropSurfaces(saved.slug)

    return {
      ok: true as const,
      drop: saved,
      drops,
      selectedId: saved.id,
    }
  } catch (error) {
    if (error instanceof DropCtaMigrationRequiredError || error instanceof DropArchiveSizeStockMigrationRequiredError) {
      return {
        ok: false as const,
        error: error.message,
        code: error.code,
      }
    }

    if (error instanceof DropStorageUnavailableError) {
      return {
        ok: false as const,
        error: error.message,
        code: error.code,
      }
    }

    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo guardar el drop",
    }
  }
}

export async function reserveDropPrelaunch(payload: z.infer<typeof reserveDropSchema>) {
  try {
    const parsed = reserveDropSchema.parse(payload)
    const reservation = await reserveDrop({
      dropId: parsed.dropId,
      idempotencyKey: parsed.idempotencyKey,
      customerName: parsed.customerName,
      phone: normalizePhone(parsed.phone),
      selectedSize: parsed.selectedSize,
      selectedColor: parsed.selectedColor,
    })

    revalidateDropSurfaces()

    return {
      ok: true as const,
      reservation,
    }
  } catch (error) {
    if (error instanceof DropStorageUnavailableError) {
      return {
        ok: false as const,
        error: publicDropErrorMessage(error),
        code: error.code,
      }
    }

    return {
      ok: false as const,
      error: publicDropErrorMessage(error),
      code: error instanceof Error && /reservation_cancelled_idempotency_key/i.test(error.message)
        ? "reservation_cancelled_idempotency_key"
        : undefined,
    }
  }
}

export async function archiveDropFromAdmin(payload: z.infer<typeof archiveDropSchema>) {
  try {
    const { user } = await requireAdminUser()
    const parsed = archiveDropSchema.parse(payload)
    const drop = await archiveDropRecord({
      id: parsed.dropId,
      actor: user.email ?? user.id,
      reason: parsed.reason,
    })
    const drops = await listAdminDrops()

    revalidateDropSurfaces(drop.slug)

    return { ok: true as const, drop, drops, selectedId: drop.id }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo archivar el drop",
      code: error instanceof DropStorageUnavailableError || error instanceof DropArchiveSizeStockMigrationRequiredError ? error.code : undefined,
    }
  }
}

export async function unarchiveDropFromAdmin(payload: z.infer<typeof unarchiveDropSchema>) {
  try {
    const { user } = await requireAdminUser()
    const parsed = unarchiveDropSchema.parse(payload)
    const drop = await unarchiveDropRecord({
      id: parsed.dropId,
      actor: user.email ?? user.id,
    })
    const drops = await listAdminDrops()

    revalidateDropSurfaces(drop.slug)

    return { ok: true as const, drop, drops, selectedId: drop.id }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo desarchivar el drop",
      code: error instanceof DropStorageUnavailableError || error instanceof DropArchiveSizeStockMigrationRequiredError ? error.code : undefined,
    }
  }
}

export async function cancelDropReservationFromAdmin(payload: z.infer<typeof cancelReservationSchema>) {
  try {
    await requireAdminUser()
    const parsed = cancelReservationSchema.parse(payload)
    const result = await cancelDropReservation({
      reservationId: parsed.reservationId,
      reason: parsed.reason,
    })

    revalidateDropSurfaces()

    return {
      ok: true as const,
      result,
    }
  } catch (error) {
    if (error instanceof DropStorageUnavailableError) {
      return {
        ok: false as const,
        error: error.message,
        code: error.code,
      }
    }

    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo cancelar la preventa",
    }
  }
}
