"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdminUser } from "@/lib/admin-auth"
import {
  DEFAULT_DROP_LAUNCH_LOCAL,
  DROP_LAUNCH_TIME_ZONE,
  localDateTimeToUtcIso,
  parseDropImageList,
  parseDropOptionList,
} from "@/src/data/drops"
import { DropStorageUnavailableError } from "@/src/data/drop-storage-status"
import {
  cancelDropReservation,
  createDropRecord,
  listAdminDrops,
  reserveDrop,
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
  sizes: z.union([z.string(), z.array(z.string())]).default(""),
  stockTotal: z.coerce.number().int().min(0, "El stock debe ser entero y no negativo"),
  launchAtLocal: z.string().trim().min(1, "La fecha de lanzamiento es obligatoria").default(DEFAULT_DROP_LAUNCH_LOCAL),
  launchTimezone: z.string().trim().default(DROP_LAUNCH_TIME_ZONE),
  isActive: z.boolean().default(false),
  floatingEnabled: z.boolean().default(false),
  floatingMessage: z.string().max(600, "El mensaje puede tener como máximo 600 caracteres").default(""),
  isClosed: z.boolean().default(false),
})

const reserveDropSchema = z.object({
  dropId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(160),
})

const cancelReservationSchema = z.object({
  reservationId: z.string().uuid(),
  reason: z.string().trim().max(300).optional(),
})

function normalizeDropForm(input: z.input<typeof dropFormSchema>) {
  const parsed = dropFormSchema.parse(input)
  const slug = parsed.slug?.trim() ? slugifyFlavorName(parsed.slug) : slugifyFlavorName(parsed.name)
  const imageUrls = parseDropImageList(parsed.imageUrls)
  const colors = parseDropOptionList(parsed.colors)
  const sizes = parseDropOptionList(parsed.sizes)

  if (!slug) {
    throw new Error("No se pudo generar el identificador del drop")
  }

  if (parsed.isActive && (!colors.length || !sizes.length)) {
    throw new Error("Antes de activar un drop debes configurar al menos una talla y un color")
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
    stockTotal: parsed.stockTotal,
    launchAt: localDateTimeToUtcIso(parsed.launchAtLocal, parsed.launchTimezone || DROP_LAUNCH_TIME_ZONE),
    launchTimezone: parsed.launchTimezone || DROP_LAUNCH_TIME_ZONE,
    isActive: parsed.isActive,
    floatingEnabled: parsed.floatingEnabled,
    floatingMessage: parsed.floatingMessage,
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
