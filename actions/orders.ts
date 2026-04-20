"use server"

import { z } from "zod"

import {
  buildOrderSearchPhoneVariants,
  dedupeAdminSearchOrders,
  escapeOrderSearchLikeValue,
  hasOrderSearchLetters,
  isOrderSearchQueryValid,
  normalizeOrderSearchText,
} from "@/lib/admin/order-search"
import { createClient } from "@/lib/supabase/server"

const orderItemSchema = z.object({
  type: z.enum(["cake", "box"]),
  flavor: z.string().min(1),
  qty: z.number().int().positive(),
})

const createOrderSchema = z.object({
  delivery_date: z.string(),
  status: z.string().default("pending"),
  customer_name: z.string().min(1),
  customer_email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
})

const updateOrderSchema = z.object({
  id: z.string().uuid(),
  delivery_date: z.string().optional(),
  status: z.string().optional(),
  customer_name: z.string().min(1).nullable().optional(),
  customer_email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

const deleteOrderSchema = z.object({ id: z.string().uuid() })

const cancelOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().max(300).optional(),
})

const searchOrdersSchema = z.object({
  query: z.string(),
})

const markDoneSchema = z.object({
  orderId: z.string().uuid(),
})

const ORDER_SEARCH_SELECT =
  "id, delivery_date, status, customer_name, customer_email, phone, created_at, cancelled_at, cancelled_reason, notes, order_items(type, flavor, qty)"

type SearchOrderResult = Awaited<ReturnType<typeof listOrders>>[number]

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
      customer_email: parsed.customer_email ?? null,
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

export async function searchOrders(query: string) {
  try {
    const parsed = searchOrdersSchema.parse({ query })
    const supabase = await createClient()
    const textQuery = normalizeOrderSearchText(parsed.query)
    const escapedTextQuery = escapeOrderSearchLikeValue(textQuery)
    const phoneQueries = buildOrderSearchPhoneVariants(textQuery)

    if (!isOrderSearchQueryValid(parsed.query)) {
      return { ok: false, error: "Introduce al menos 2 letras o 6 dígitos", results: [] as unknown[] }
    }

    const resultSets: SearchOrderResult[][] = []

    for (const phoneQuery of phoneQueries) {
      const { data, error } = await supabase
        .from("orders")
        .select(ORDER_SEARCH_SELECT)
        .neq("status", "cancelled")
        .like("phone_normalized", `%${phoneQuery}%`)
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) {
        return { ok: false, error: error.message, results: [] as unknown[] }
      }

      resultSets.push((data ?? []) as SearchOrderResult[])
    }

    if (escapedTextQuery.length >= 2 && hasOrderSearchLetters(textQuery)) {
      const { data, error } = await supabase
        .from("orders")
        .select(ORDER_SEARCH_SELECT)
        .neq("status", "cancelled")
        .or(
          `customer_name.ilike.%${escapedTextQuery}%,customer_email.ilike.%${escapedTextQuery}%,notes.ilike.%${escapedTextQuery}%`
        )
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) {
        return { ok: false, error: error.message, results: [] as unknown[] }
      }

      resultSets.push((data ?? []) as SearchOrderResult[])

      const { data: itemMatches, error: itemsError } = await supabase
        .from("order_items")
        .select("order_id")
        .ilike("flavor", `%${escapedTextQuery}%`)
        .limit(20)

      if (itemsError) {
        return { ok: false, error: itemsError.message, results: [] as unknown[] }
      }

      const orderIds = Array.from(new Set((itemMatches ?? []).map((item) => item.order_id).filter(Boolean)))

      if (orderIds.length) {
        const { data: flavorOrders, error: flavorOrdersError } = await supabase
          .from("orders")
          .select(ORDER_SEARCH_SELECT)
          .neq("status", "cancelled")
          .in("id", orderIds)
          .order("created_at", { ascending: false })
          .limit(20)

        if (flavorOrdersError) {
          return { ok: false, error: flavorOrdersError.message, results: [] as unknown[] }
        }

        resultSets.push((flavorOrders ?? []) as SearchOrderResult[])
      }
    }

    return { ok: true, results: dedupeAdminSearchOrders(resultSets.flat()).slice(0, 20) }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al buscar pedidos"
    return { ok: false, error: message, results: [] as unknown[] }
  }
}

export async function cancelOrder(orderId: string, reason?: string) {
  try {
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
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al anular pedido"
    return { ok: false, error: message }
  }
}


export async function markOrderDone(orderId: string) {
  try {
    const parsed = markDoneSchema.parse({ orderId })
    const supabase = await createClient()

    const { error } = await supabase
      .from("orders")
      .update({
        status: "done",
        done_at: new Date().toISOString(),
      })
      .eq("id", parsed.orderId)
      .neq("status", "cancelled")

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al marcar pedido como hecho"
    return { ok: false, error: message }
  }
}

export async function reopenOrder(orderId: string) {
  try {
    const parsed = markDoneSchema.parse({ orderId })
    const supabase = await createClient()

    const { error } = await supabase
      .from("orders")
      .update({
        status: "pending",
        done_at: null,
      })
      .eq("id", parsed.orderId)
      .eq("status", "done")

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al reabrir pedido"
    return { ok: false, error: message }
  }
}
