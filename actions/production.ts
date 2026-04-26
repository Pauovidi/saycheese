"use server"

import { z } from "zod"

import {
  buildGroupedProductionDetails,
  buildProductionCopyText,
  buildProductionFlavorSummary,
  type ProductionFlavorSummaryGroup,
  type ProductionGroupedBlock,
} from "@/lib/admin/production-presentation"
import { createClient } from "@/lib/supabase/server"
import { getCatalogFlavors } from "@/src/data/products-store"

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

export interface ProductionDetailLine {
  orderId: string
  type: "cake" | "box"
  flavor: string
  qty: number
  phone: string | null
  customerName: string | null
  deliveryDate: string
  createdAt: string
}

export interface ProductionResponse {
  rangeLabel: string
  totals: {
    cakes: number
    boxes: number
  }
  summaryByType: ProductionFlavorSummaryGroup[]
  groups: ProductionGroupedBlock[]
  copyText: string
}

function formatRangeDateLabel(value?: string) {
  if (!value) return ""

  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return value

  return `${day}/${month}/${year}`
}

function toRangeLabel(input: z.infer<typeof productionInputSchema>): string {
  if (input.mode === "single") {
    return formatRangeDateLabel(input.day)
  }

  return `${formatRangeDateLabel(input.from)} → ${formatRangeDateLabel(input.to)}`
}

export async function getProduction(input: z.infer<typeof productionInputSchema>): Promise<ProductionResponse> {
  const parsed = productionInputSchema.parse(input)
  const supabase = await createClient()

  let query = supabase
    .from("order_items")
    .select("order_id, type, flavor, qty, orders!inner(created_at, delivery_date, status, phone, customer_name)")
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

  const totals = {
    cakes: 0,
    boxes: 0,
  }
  const details: ProductionDetailLine[] = []

  for (const item of data ?? []) {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders

    if (item.type === "cake") {
      totals.cakes += item.qty
    } else {
      totals.boxes += item.qty
    }

    details.push({
      orderId: item.order_id,
      type: item.type,
      flavor: item.flavor,
      qty: item.qty,
      phone: order?.phone ?? null,
      customerName: order?.customer_name ?? null,
      deliveryDate: order?.delivery_date ?? "",
      createdAt: order?.created_at ?? "",
    })
  }

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

  const catalogFlavors = await getCatalogFlavors()
  const productionCatalogFlavors = catalogFlavors.map((flavor) => ({
    category: flavor.category,
    label: flavor.label,
  }))
  const summaryByType = buildProductionFlavorSummary(details, productionCatalogFlavors)
  const groups = buildGroupedProductionDetails(details, productionCatalogFlavors)
  const rangeLabel = toRangeLabel(parsed)

  return {
    rangeLabel,
    totals,
    summaryByType,
    groups,
    copyText: buildProductionCopyText({
      rangeLabel,
      totals,
      summaryByType,
      groups,
    }),
  }
}
