export type ManualOrderFormValues = {
  customerName: string
  phone: string
  deliveryDate: string
  format: "tarta" | "cajita"
  flavor: string
  quantity: number
}

export function buildManualOrderPayload(values: ManualOrderFormValues) {
  return {
    delivery_date: values.deliveryDate.trim(),
    status: "pending",
    customer_name: values.customerName.trim(),
    phone: values.phone.trim(),
    items: [
      {
        type: values.format === "tarta" ? "cake" : "box",
        flavor: values.flavor.trim(),
        qty: values.quantity,
      },
    ],
  }
}
