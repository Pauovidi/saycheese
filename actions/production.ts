"use server"

import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

const productionInputSchema = z
  .object({
    mode: z.enum(["single", "range"]),
    day: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    types: z.array(z.enum(["cake", "box"]))
      .min(1, "Selecciona al menos un tipo"),
    includeDone: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "single" && !data.day) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Falta la fecha",
        path: ["day"],
      })
    }

    if (data.mode === "range" && (!data.from || !data.to)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Falta el rango",
        path: ["from"],
      })
    }
  })

interface Bucket {
  flavor: string
  qty: number
}

export interface ProductionDetailLine {
  orderId: string
  type: "cake" | "box"
  flavor: string
  qty: number
  phone: string | null
  deliveryDate: string
  createdAt: string
}

export interface ProductionResponse {
  rangeLabel: string
  cakes: Bucket[]
  boxes: Bucket[]
  details: ProductionDetailLine[]
  totals: {
    cakes: number
    boxes: number
  }
}

function toRangeLabel(input: z.infer<typeof productionInputSchema>): string {
  if (input.mode === "single") {
    return input.day ?? ""
  }

  return `${input.from} → ${input.to}`
}

export async function getProduction(input: z.infer<typeof productionInputSchema>): Promise<ProductionResponse> {
  const parsed = productionInputSchema.parse(input)
  const supabase = await createClient()

  let query = supabase
    .from("order_items")
    .select("order_id, type, flavor, qty, orders!inner(created_at, delivery_date, status, phone)")
    .in("type", parsed.types)

  if (parsed.includeDone) {
    query = query.in("orders.status", ["pending", "done"])
  } else {
    query = query.eq("orders.status", "pending")
  }

  if (parsed.mode === "single" && parsed.day) {
    query = query.eq("orders.delivery_date", parsed.day)
  }

  if (parsed.mode === "range" && parsed.from && parsed.to) {
    query = query
      .gte("orders.delivery_date", parsed.from)
      .lte("orders.delivery_date", parsed.to)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const cakesMap = new Map<string, number>()
  const boxesMap = new Map<string, number>()
  const details: ProductionDetailLine[] = []

  for (const item of data ?? []) {
    const map = item.type === "cake" ? cakesMap : boxesMap
    map.set(item.flavor, (map.get(item.flavor) ?? 0) + item.qty)

    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders

    details.push({
      orderId: item.order_id,
      type: item.type,
      flavor: item.flavor,
      qty: item.qty,
      phone: order?.phone ?? null,
      deliveryDate: order?.delivery_date ?? "",
      createdAt: order?.created_at ?? "",
    })
  }

  const cakes = Array.from(cakesMap.entries())
    .map(([flavor, qty]) => ({ flavor, qty }))
    .sort((a, b) => b.qty - a.qty)

  const boxes = Array.from(boxesMap.entries())
    .map(([flavor, qty]) => ({ flavor, qty }))
    .sort((a, b) => b.qty - a.qty)

  details.sort((a, b) => {
    if (a.deliveryDate !== b.deliveryDate) {
      return a.deliveryDate.localeCompare(b.deliveryDate)
    }

    if (a.createdAt !== b.createdAt) {
      return a.createdAt.localeCompare(b.createdAt)
    }

    if (a.orderId !== b.orderId) {
      return a.orderId.localeCompare(b.orderId)
    }

    if (a.type !== b.type) {
      return a.type === "cake" ? -1 : 1
    }

    return a.flavor.localeCompare(b.flavor, "es")
  })

  return {
    rangeLabel: toRangeLabel(parsed),
    cakes,
    boxes,
    details,
    totals: {
      cakes: cakes.reduce((sum, row) => sum + row.qty, 0),
      boxes: boxes.reduce((sum, row) => sum + row.qty, 0),
    },
  }
}
