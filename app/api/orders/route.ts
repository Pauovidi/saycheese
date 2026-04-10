import { NextResponse } from "next/server"
import { z } from "zod"

import { addDaysToToday, computeReminderAt } from "@/lib/chatbot/reminders"
import { getAdminClient, getAdminUid } from "@/lib/supabase/admin"

const orderPayloadSchema = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email().optional().nullable(),
  phone: z.string().min(6),
  delivery_date: z.string().date().optional().nullable(),
  items: z
    .array(
      z.object({
        type: z.enum(["cake", "box"]),
        flavor: z.string().min(1),
        qty: z.number().int().positive(),
      })
    )
    .min(1),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = orderPayloadSchema.parse(body)
    const adminUid = await getAdminUid()
    const supabase = getAdminClient()
    const createdAt = new Date()
    const usedDefaultDeliveryDate = !payload.delivery_date
    const deliveryDateFinal = payload.delivery_date || addDaysToToday(3)
    const reminderAt = computeReminderAt({ createdAt, deliveryDate: deliveryDateFinal, usedDefaultDeliveryDate })

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: adminUid,
        delivery_date: deliveryDateFinal,
        status: "pending",
        customer_name: payload.customer_name,
        customer_email: payload.customer_email ?? null,
        phone: payload.phone,
        reminder_at: reminderAt,
        reminder_status: "pending",
      })
      .select("id")
      .single()

    if (orderError || !order) {
      throw new Error(orderError?.message ?? "No se pudo crear order")
    }

    const { error: itemError } = await supabase
      .from("order_items")
      .insert(
        payload.items.map((item) => ({
          order_id: order.id,
          ...item,
        }))
      )

    if (itemError) {
      await supabase.from("orders").delete().eq("id", order.id)
      throw new Error(itemError.message)
    }

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

    const message = error instanceof Error ? error.message : "Error interno"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
