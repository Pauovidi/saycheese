const NULLABLE_STRING_TOOL_SCHEMA = { type: ["string", "null"] as const }

export const CREATE_ORDER_TOOL_PARAMETERS = {
  type: "object",
  properties: {
    customer_name: { type: "string" },
    customer_email: NULLABLE_STRING_TOOL_SCHEMA,
    phone: { type: "string" },
    delivery_date: { type: "string" },
    notes: NULLABLE_STRING_TOOL_SCHEMA,
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["cake", "box"] },
          flavor: { type: "string" },
          qty: { type: "number" },
        },
        required: ["type", "flavor", "qty"],
        additionalProperties: false,
      },
    },
  },
  required: ["customer_name", "customer_email", "phone", "delivery_date", "notes", "items"],
  additionalProperties: false,
} as const

export const CANCEL_ORDER_TOOL_PARAMETERS = {
  type: "object",
  properties: {
    phone: { type: "string" },
    order_hint: NULLABLE_STRING_TOOL_SCHEMA,
  },
  required: ["phone", "order_hint"],
  additionalProperties: false,
} as const

export const HANDOFF_TO_HUMAN_TOOL_PARAMETERS = {
  type: "object",
  properties: { reason: NULLABLE_STRING_TOOL_SCHEMA },
  required: ["reason"],
  additionalProperties: false,
} as const
