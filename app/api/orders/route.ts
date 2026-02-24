import { NextResponse } from "next/server"
import { z } from "zod"

import { createAdminClient, getAdminUid } from "@/lib/supabase/admin"

const orderPayloadSchema = z.object({
  customer_name: z.string().min(1).optional(),
  customer_email: z.string().email(),
  phone: z.string().min(6),
  delivery_date: z.string().date(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      type: z.enum(["cake", "box"]),
      flavor: z.string().min(1),
      qty: z.number().int().positive(),
    })
  ).min(1),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = orderPayloadSchema.parse(body)
    const adminUid = await getAdminUid()
    const supabase = createAdminClient()

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: adminUid,
        delivery_date: payload.delivery_date,
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

    return NextResponse.json({ ok: true, orderId: order.id })
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
