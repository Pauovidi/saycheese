import type { ChatOrderItem } from "@/lib/chatbot/order-dedupe"

export type ManualOrderFormat = "tarta" | "cajita"

export type ManualOrderItemFormValues = {
  format: ManualOrderFormat | ""
  flavor: string
  quantity: number
}

export type ManualOrderFormValues = {
  customerName: string
  phone: string
  deliveryDate: string
  notes: string
  items: ManualOrderItemFormValues[]
}

export type ManualOrderValidationErrors = Record<string, string>

export function createManualOrderItem(defaultFlavor = ""): ManualOrderItemFormValues {
  return {
    format: "tarta",
    flavor: defaultFlavor,
    quantity: 1,
  }
}

function getManualOrderItemType(format: ManualOrderItemFormValues["format"]): ChatOrderItem["type"] {
  return format === "cajita" ? "box" : "cake"
}

export function validateManualOrderForm(values: ManualOrderFormValues): ManualOrderValidationErrors {
  const errors: ManualOrderValidationErrors = {}

  if (!values.customerName.trim()) {
    errors.customerName = "Falta el nombre del cliente"
  }

  if (!values.phone.trim()) {
    errors.phone = "Falta el teléfono del cliente"
  }

  if (!values.deliveryDate.trim()) {
    errors.deliveryDate = "Falta la fecha de recogida"
  }

  if (!values.items.length) {
    errors.items = "Añade al menos una tarta"
  }

  values.items.forEach((item, index) => {
    if (!item.format) {
      errors[`items.${index}.format`] = "Falta el tamaño"
    }

    if (!item.flavor.trim()) {
      errors[`items.${index}.flavor`] = "Falta el sabor"
    }

    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      errors[`items.${index}.quantity`] = "La cantidad mínima es 1"
    }
  })

  return errors
}

export function hasManualOrderValidationErrors(errors: ManualOrderValidationErrors) {
  return Object.keys(errors).length > 0
}

export function buildManualOrderItems(items: ManualOrderItemFormValues[]): ChatOrderItem[] {
  return items.map((item) => ({
    type: getManualOrderItemType(item.format),
    flavor: item.flavor.trim(),
    qty: item.quantity,
  }))
}

export function buildManualOrderPayload(values: ManualOrderFormValues) {
  const errors = validateManualOrderForm(values)

  if (hasManualOrderValidationErrors(errors)) {
    throw new Error(Object.values(errors)[0] ?? "Pedido manual incompleto")
  }

  const notes = values.notes.trim()

  return {
    delivery_date: values.deliveryDate.trim(),
    status: "pending",
    skip_lead_days: true,
    customer_name: values.customerName.trim(),
    phone: values.phone.trim(),
    ...(notes ? { notes } : {}),
    items: buildManualOrderItems(values.items),
  }
}
