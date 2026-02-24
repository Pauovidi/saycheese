import { NextResponse } from "next/server"
import { z } from "zod"

import { sendOrderConfirmation } from "@/lib/mailer"
import { getAdminClient, getAdminUid } from "@/lib/supabase/admin"

const orderPayloadSchema = z.object({
  customer_name: z.string().min(1).optional(),
  customer_email: z.string().email(),
  phone: z.string().min(6),
  delivery_date: z.string().date().optional().nullable(),
  notes: z.string().optional(),
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

function addDaysToToday(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = orderPayloadSchema.parse(body)
    const adminUid = await getAdminUid()
    const supabase = getAdminClient()
    const deliveryDateFinal = payload.delivery_date || addDaysToToday(3)

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: adminUid,
        delivery_date: deliveryDateFinal,
        status: "pending",
        customer_name: payload.customer_name,
        customer_email: payload.customer_email,
        phone: payload.phone,
        notes: payload.notes,
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

    let warningEmail = false
    try {
      await sendOrderConfirmation({
        to: payload.customer_email,
        orderId: order.id,
        deliveryDate: deliveryDateFinal,
        items: payload.items,
        name: payload.customer_name,
        phone: payload.phone,
      })
    } catch (mailError) {
      warningEmail = true
      console.error("No se pudo enviar email de confirmación", mailError)
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      delivery_date_final: deliveryDateFinal,
      warningEmail,
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
