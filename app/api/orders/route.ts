import { NextResponse } from "next/server"
import { z } from "zod"

import { computeReminderAt } from "@/lib/chatbot/reminders"
import { sendWebOrderWhatsappConfirmation } from "@/lib/chatbot/whatsapp-confirmation"
import { buildUnavailableFlavorMessage, resolveFlavorAvailability } from "@/lib/chatbot/products"
import { normalizePhoneOrNull } from "@/lib/phone"
import { getOrderPickupDateErrorMessage, validateOrderPickupDate } from "@/lib/pickup-date-validation"
import { getAdminClient, getAdminUid } from "@/lib/supabase/admin"
import { DropStorageUnavailableError } from "@/src/data/drop-storage-status"
import { createOrderWithItems } from "@/src/data/drops-store"

const LEAD_DAYS_RAW = Number.parseInt(process.env.CHATBOT_LEAD_DAYS ?? "3", 10)
const LEAD_DAYS = Number.isFinite(LEAD_DAYS_RAW) && LEAD_DAYS_RAW > 0 ? LEAD_DAYS_RAW : 3
const SHOP_TZ = process.env.SHOP_TZ ?? "Europe/Madrid"

const orderPayloadSchema = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email().optional().nullable(),
  phone: z.string().min(6),
  delivery_date: z.string().date().optional().nullable(),
  items: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          type: z.enum(["cake", "box"]),
          flavor: z.string().min(1),
          qty: z.number().int().positive(),
        }),
        z.object({
          type: z.literal("drop"),
          flavor: z.string().min(1).optional(),
          drop_id: z.string().uuid(),
          selected_size: z.string().min(1),
          selected_color: z.string().min(1),
          qty: z.number().int().positive(),
        }),
      ])
    )
    .min(1),
})

type ParsedOrderPayload = z.infer<typeof orderPayloadSchema>
type ParsedCakeOrderItem = Extract<ParsedOrderPayload["items"][number], { type: "cake" | "box" }>

async function createCakeOrderDirectly(input: {
  adminUid: string
  deliveryDateFinal: string
  payload: z.infer<typeof orderPayloadSchema>
  reminderAt: string | null
  supabase: ReturnType<typeof getAdminClient>
}) {
  const { data: order, error: orderError } = await input.supabase
    .from("orders")
    .insert({
      user_id: input.adminUid,
      delivery_date: input.deliveryDateFinal,
      status: "pending",
      customer_name: input.payload.customer_name,
      customer_email: input.payload.customer_email ?? null,
      phone: input.payload.phone,
      phone_normalized: normalizePhoneOrNull(input.payload.phone),
      reminder_at: input.reminderAt,
      reminder_status: "pending",
    })
    .select("id")
    .single()

  if (orderError || !order) {
    throw new Error(orderError?.message ?? "No se pudo crear order")
  }

  const { error: itemError } = await input.supabase.from("order_items").insert(
    input.payload.items.map((item) => ({
      order_id: order.id,
      ...item,
    }))
  )

  if (itemError) {
    await input.supabase.from("orders").delete().eq("id", order.id)
    throw new Error(itemError.message)
  }

  return order
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = orderPayloadSchema.parse(body)
    const adminUid = await getAdminUid()
    const supabase = getAdminClient()
    const createdAt = new Date()
    const deliveryDateValidation = validateOrderPickupDate(payload.delivery_date, createdAt, LEAD_DAYS, SHOP_TZ)

    if (deliveryDateValidation.kind !== "valid") {
      return NextResponse.json(
        {
          ok: false,
          error: getOrderPickupDateErrorMessage(deliveryDateValidation, LEAD_DAYS, SHOP_TZ),
        },
        { status: 400 }
      )
    }

    const cakeItems = payload.items.filter((item): item is ParsedCakeOrderItem => item.type === "cake" || item.type === "box")
    const hasDropItems = payload.items.some((item) => item.type === "drop")
    const flavorChecks = await Promise.all(cakeItems.map((item) => resolveFlavorAvailability(item.flavor)))
    const unavailableFlavor = flavorChecks.find((check) => !check.available)

    if (unavailableFlavor) {
      const flavorName = "flavor" in unavailableFlavor ? unavailableFlavor.flavor : "ese sabor"
      return NextResponse.json(
        {
          ok: false,
          error: await buildUnavailableFlavorMessage(flavorName, { channel: "web" }),
        },
        { status: 400 }
      )
    }

    const deliveryDateFinal = deliveryDateValidation.pickupDate
    const reminderAt = computeReminderAt({ createdAt, deliveryDate: deliveryDateFinal, usedDefaultDeliveryDate: false })

    const order = hasDropItems
      ? await createOrderWithItems({
          userId: adminUid,
          deliveryDate: deliveryDateFinal,
          status: "pending",
          customerName: payload.customer_name,
          customerEmail: payload.customer_email ?? null,
          phone: payload.phone,
          reminderAt,
          reminderStatus: "pending",
          items: payload.items.map((item) =>
            item.type === "drop"
              ? {
                  type: "drop",
                  drop_id: item.drop_id,
                  selected_size: item.selected_size,
                  selected_color: item.selected_color,
                  qty: item.qty,
                }
              : item
          ),
        })
      : await createCakeOrderDirectly({
          adminUid,
          deliveryDateFinal,
          payload,
          reminderAt,
          supabase,
        })

    await sendWebOrderWhatsappConfirmation({
      orderId: order.id,
      channel: "web",
      phone: payload.phone,
      deliveryDate: deliveryDateFinal,
      items: payload.items,
    })

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      delivery_date_final: deliveryDateFinal,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Payload inválido", details: error.flatten() },
        { status: 400 }
      )
    }

    if (error instanceof DropStorageUnavailableError) {
      return NextResponse.json(
        { ok: false, error: "Los drops no están disponibles temporalmente.", code: error.code },
        { status: error.status }
      )
    }

    const message = error instanceof Error ? error.message : "Error interno"
    if (/drop_archived/i.test(message)) {
      return NextResponse.json({ ok: false, error: "Este drop ya no está disponible.", code: "drop_archived" }, { status: 400 })
    }
    if (/drop_size_sold_out|invalid_drop_size/i.test(message)) {
      return NextResponse.json({ ok: false, error: "La talla seleccionada ya no está disponible.", code: "drop_size_sold_out" }, { status: 400 })
    }
    if (/drop_sold_out/i.test(message)) {
      return NextResponse.json({ ok: false, error: "Agotado", code: "drop_sold_out" }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
