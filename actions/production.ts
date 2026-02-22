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

export interface ProductionResponse {
  rangeLabel: string
  cakes: Bucket[]
  boxes: Bucket[]
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
    .select("type, flavor, qty, orders!inner(delivery_date)")
    .in("type", parsed.types)

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

  for (const item of data ?? []) {
    const map = item.type === "cake" ? cakesMap : boxesMap
    map.set(item.flavor, (map.get(item.flavor) ?? 0) + item.qty)
  }

  const cakes = Array.from(cakesMap.entries())
    .map(([flavor, qty]) => ({ flavor, qty }))
    .sort((a, b) => b.qty - a.qty)

  const boxes = Array.from(boxesMap.entries())
    .map(([flavor, qty]) => ({ flavor, qty }))
    .sort((a, b) => b.qty - a.qty)

  return {
    rangeLabel: toRangeLabel(parsed),
    cakes,
    boxes,
    totals: {
      cakes: cakes.reduce((sum, row) => sum + row.qty, 0),
      boxes: boxes.reduce((sum, row) => sum + row.qty, 0),
    },
  }
}
