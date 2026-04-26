export type ManualOrderFormValues = {
  customerName: string
  phone: string
  deliveryDate: string
  format: "tarta" | "cajita"
  flavor: string
  quantity: number
}

export function buildManualOrderPayload(values: ManualOrderFormValues) {
  const type: "cake" | "box" = values.format === "tarta" ? "cake" : "box"

  return {
    delivery_date: values.deliveryDate.trim(),
    status: "pending",
    skip_lead_days: true,
    customer_name: values.customerName.trim(),
    phone: values.phone.trim(),
    items: [
      {
        type,
        flavor: values.flavor.trim(),
        qty: values.quantity,
      },
    ],
  }
}
