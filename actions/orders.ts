"use server"

import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

const orderItemSchema = z.object({
  type: z.enum(["cake", "box"]),
  flavor: z.string().min(1),
  qty: z.number().int().positive(),
})

const createOrderSchema = z.object({
  delivery_date: z.string(),
  status: z.string().default("pending"),
  customer_name: z.string().optional(),
  customer_email: z.string().email(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
})

const updateOrderSchema = z.object({
  id: z.string().uuid(),
  delivery_date: z.string().optional(),
  status: z.string().optional(),
  customer_name: z.string().nullable().optional(),
  customer_email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

const deleteOrderSchema = z.object({ id: z.string().uuid() })

const cancelOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().max(300).optional(),
})

const searchOrdersByPhoneSchema = z.object({
  phoneQuery: z.string().min(1, "Introduce un teléfono"),
  includeCancelled: z.boolean().optional().default(false),
})

function normalizePhone(value: string) {
  return value.replace(/\D/g, "")
}

export async function createOrder(payload: z.infer<typeof createOrderSchema>) {
  const parsed = createOrderSchema.parse(payload)
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("No autenticado")
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      delivery_date: parsed.delivery_date,
      status: parsed.status,
      customer_name: parsed.customer_name,
      customer_email: parsed.customer_email,
      phone: parsed.phone,
      notes: parsed.notes,
    })
    .select("id")
    .single()

  if (orderError || !order) {
    throw new Error(orderError?.message ?? "No se pudo crear el pedido")
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    parsed.items.map((item) => ({
      order_id: order.id,
      ...item,
    }))
  )

  if (itemsError) {
    throw new Error(itemsError.message)
  }

  return order
}

export async function listOrders() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("orders")
    .select("id, delivery_date, status, customer_name, customer_email, phone, notes, created_at, cancelled_at, cancelled_reason, order_items(id, type, flavor, qty)")
    .neq("status", "cancelled")
    .order("delivery_date", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function updateOrder(payload: z.infer<typeof updateOrderSchema>) {
  const parsed = updateOrderSchema.parse(payload)
  const { id, ...updates } = parsed
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select("id")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function deleteOrder(payload: z.infer<typeof deleteOrderSchema>) {
  const parsed = deleteOrderSchema.parse(payload)
  const supabase = await createClient()
  const { error } = await supabase.from("orders").delete().eq("id", parsed.id)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function searchOrdersByPhone(phoneQuery: string, includeCancelled = false) {
  const parsed = searchOrdersByPhoneSchema.parse({ phoneQuery, includeCancelled })
  const supabase = await createClient()

  const normalizedDigits = normalizePhone(parsed.phoneQuery)
  const rawPattern = `%${parsed.phoneQuery.trim()}%`
  const normalizedPattern = `%${normalizedDigits}%`

  let query = supabase
    .from("orders")
    .select(
      "id, created_at, delivery_date, customer_name, customer_email, phone, status, cancelled_at, cancelled_reason, order_items(type, flavor, qty)"
    )
    .or(`phone.ilike.${rawPattern},phone.ilike.${normalizedPattern}`)
    .order("created_at", { ascending: false })
    .limit(20)

  if (!parsed.includeCancelled) {
    query = query.neq("status", "cancelled")
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function cancelOrder(orderId: string, reason?: string) {
  const parsed = cancelOrderSchema.parse({ orderId, reason })
  const supabase = await createClient()

  const { error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_reason: parsed.reason || null,
    })
    .eq("id", parsed.orderId)

  if (error) {
    throw new Error(error.message)
  }

  return { ok: true }
}
