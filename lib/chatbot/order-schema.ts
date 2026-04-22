import { z } from "zod"

export const createOrderInputSchema = z.object({
  customer_name: z.string().trim().min(1),
  customer_email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().min(6),
  delivery_date: z.string().date().optional(),
  notes: z.string().nullable().optional(),
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
