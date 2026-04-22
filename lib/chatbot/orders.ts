import "server-only"

import { z } from "zod"

import { areEquivalentOrderItems, buildChatOrderFingerprint, type ChatOrderItem } from "@/lib/chatbot/order-dedupe"
import { normalizePhone, normalizePhoneOrNull } from "@/lib/phone"
import { isKnownFlavor } from "@/lib/chatbot/products"
import { computeReminderAt } from "@/lib/chatbot/reminders"
import { getOrderPickupDateErrorMessage, validateOrderPickupDate } from "@/lib/pickup-date-validation"
import { getAdminClient, getAdminUid } from "@/lib/supabase/admin"

const LEAD_DAYS_RAW = Number.parseInt(process.env.CHATBOT_LEAD_DAYS ?? "3", 10)
const LEAD_DAYS = Number.isFinite(LEAD_DAYS_RAW) && LEAD_DAYS_RAW > 0 ? LEAD_DAYS_RAW : 3
const SHOP_TZ = process.env.SHOP_TZ ?? "Europe/Madrid"

const createOrderInputSchema = z.object({
  customer_name: z.string().trim().min(1),
  customer_email: z.string().trim().email().optional(),
  phone: z.string().trim().min(6),
  delivery_date: z.string().date().optional(),
  notes: z.string().optional(),
  forceNewOrder: z.boolean().optional(),
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

async function findRecentDuplicateOrder(input: {
  createdAt: Date
  phone: string
  deliveryDate: string
  items: ChatOrderItem[]
}) {
  const supabase = getAdminClient()
  const createdAfter = new Date(input.createdAt.getTime() - 10 * 60 * 1000).toISOString()
  const expectedFingerprint = buildChatOrderFingerprint({
    phone: input.phone,
    deliveryDate: input.deliveryDate,
    items: input.items,
  })
  const normalizedPhone = normalizePhone(input.phone)

  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, delivery_date, customer_name, phone, phone_normalized, reminder_at, order_items(type, flavor, qty)")
    .neq("status", "cancelled")
    .eq("delivery_date", input.deliveryDate)
    .gte("created_at", createdAfter)
    .order("created_at", { ascending: false })
    .limit(25)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).find((order) => {
    const orderPhone = normalizePhone(order.phone_normalized ?? order.phone ?? "")
    if (orderPhone !== normalizedPhone) {
      return false
    }

    const orderItems = ((order.order_items ?? []) as ChatOrderItem[]).map((item) => ({
      type: item.type,
      flavor: item.flavor,
      qty: item.qty,
    }))

    if (!areEquivalentOrderItems(orderItems, input.items)) {
      return false
    }

    const orderFingerprint = buildChatOrderFingerprint({
      phone: order.phone ?? "",
      deliveryDate: order.delivery_date,
      items: orderItems,
    })

    return orderFingerprint === expectedFingerprint
  })
}

export async function createChatOrder(input: unknown) {
  const parsed = createOrderInputSchema.safeParse(input)
  if (!parsed.success) {
    const missingName = parsed.error.issues.some((issue) => issue.path[0] === "customer_name")
    return {
      ok: false as const,
      error: missingName ? "Antes de confirmar el pedido necesito el nombre del cliente." : "No pude validar el pedido.",
      shouldHandoff: false,
    }
  }

  const payload = parsed.data
  const createdAt = new Date()

  const flavorChecks = await Promise.all(payload.items.map((item) => isKnownFlavor(item.flavor)))

  if (flavorChecks.some((isKnown) => !isKnown)) {
    return {
      ok: false as const,
      error: "Pedido ambiguo: no identifiqué uno o más sabores.",
      shouldHandoff: true,
    }
  }

  const deliveryDateValidation = validateOrderPickupDate(payload.delivery_date, createdAt, LEAD_DAYS, SHOP_TZ)

  if (deliveryDateValidation.kind !== "valid") {
    return {
      ok: false as const,
      error: getOrderPickupDateErrorMessage(deliveryDateValidation, LEAD_DAYS, SHOP_TZ),
      shouldHandoff: false,
    }
  }

  const adminUid = await getAdminUid()
  const supabase = getAdminClient()
  const deliveryDateFinal = deliveryDateValidation.pickupDate
  const reminderAt = computeReminderAt({
    createdAt,
    deliveryDate: deliveryDateFinal,
    usedDefaultDeliveryDate: false,
  })
  const duplicateOrder = payload.forceNewOrder
    ? null
    : await findRecentDuplicateOrder({
        createdAt,
        phone: payload.phone,
        deliveryDate: deliveryDateFinal,
        items: payload.items,
      })

  if (duplicateOrder) {
    return {
      ok: true as const,
      orderId: duplicateOrder.id,
      deliveryDate: deliveryDateFinal,
      reminderAt: duplicateOrder.reminder_at ?? reminderAt,
      reusedExisting: true as const,
    }
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: adminUid,
      delivery_date: deliveryDateFinal,
      status: "pending",
      customer_name: payload.customer_name,
      customer_email: payload.customer_email ?? null,
      phone: payload.phone,
      phone_normalized: normalizePhoneOrNull(payload.phone),
      notes: payload.notes,
      reminder_at: reminderAt,
      reminder_status: "pending",
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

  return { ok: true as const, orderId: order.id, deliveryDate: deliveryDateFinal, reminderAt, reusedExisting: false as const }
}

export async function cancelChatOrder(phone: string, hint?: string) {
  const supabase = getAdminClient()
  const normalizedPhone = normalizePhone(phone)

  const query = supabase
    .from("orders")
    .select("id, created_at, phone, phone_normalized")
    .neq("status", "cancelled")

  const finalQuery = hint?.trim() ? query.ilike("id", `${hint.trim()}%`) : query
  const { data, error } = await finalQuery.order("created_at", { ascending: false }).limit(50)

  if (error) throw new Error(error.message)

  const order = (data ?? []).find((candidate) => normalizePhone(candidate.phone_normalized ?? candidate.phone ?? "") === normalizedPhone)
  if (!order) {
    return { ok: false as const, error: "No encontré un pedido activo para ese teléfono.", shouldHandoff: true }
  }

  const { error: cancelError } = await supabase
    .from("orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", order.id)

  if (cancelError) throw new Error(cancelError.message)

  return { ok: true as const, orderId: order.id }
}
