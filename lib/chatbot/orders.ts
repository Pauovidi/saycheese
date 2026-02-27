import "server-only"

import { z } from "zod"

import { getAdminClient, getAdminUid } from "@/lib/supabase/admin"

const createOrderInputSchema = z.object({
  customer_name: z.string().min(1).optional(),
  customer_email: z.string().email().optional(),
  phone: z.string().min(6),
  delivery_date: z.string().date().optional(),
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

function normalizePhone(value: string) {
  return value.replace(/\D/g, "")
}

export async function createChatOrder(input: unknown) {
  const payload = createOrderInputSchema.parse(input)
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
      customer_email: payload.customer_email ?? null,
      phone: payload.phone,
      notes: payload.notes,
    })
    .select("id")
    .single()

  if (orderError || !order) {
    throw new Error(orderError?.message ?? "No se pudo crear el pedido")
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    payload.items.map((item) => ({
      order_id: order.id,
      ...item,
    }))
  )

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id)
    throw new Error(itemsError.message)
  }

  return { orderId: order.id, deliveryDate: deliveryDateFinal }
}

export async function cancelChatOrder(phone: string, hint?: string) {
  const supabase = getAdminClient()
  const normalizedPhone = normalizePhone(phone)

  const query = supabase
    .from("orders")
    .select("id, created_at")
    .neq("status", "cancelled")
    .like("phone_normalized", `%${normalizedPhone}%`)

  const withHint = hint?.trim()
  const finalQuery = withHint ? query.ilike("id", `${withHint}%`) : query

  const { data, error } = await finalQuery.order("created_at", { ascending: false }).limit(1)

  if (error) {
    throw new Error(error.message)
  }

  const order = data?.[0]

  if (!order) {
    return { ok: false as const, message: "No encontré un pedido activo para ese teléfono." }
  }

  const { error: cancelError } = await supabase
    .from("orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", order.id)

  if (cancelError) {
    throw new Error(cancelError.message)
  }

  return { ok: true as const, orderId: order.id }
}
