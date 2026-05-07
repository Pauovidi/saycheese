import test from "node:test"
import assert from "node:assert/strict"

import {
  buildManualOrderPayload,
  hasManualOrderValidationErrors,
  validateManualOrderForm,
  type ManualOrderFormValues,
} from "../lib/admin/manual-order"

test("mapea un pedido manual de una sola tarta al modelo real de pedido", () => {
  assert.deepEqual(
    buildManualOrderPayload({
      customerName: "  Pau Ovidi  ",
      phone: " +34 645 29 04 41 ",
      deliveryDate: "2026-05-02",
      notes: "",
      items: [
        {
          format: "cajita",
          flavor: " gOfIo ",
          quantity: 2,
        },
      ],
    }),
    {
      delivery_date: "2026-05-02",
      status: "pending",
      skip_lead_days: true,
      customer_name: "Pau Ovidi",
      phone: "+34 645 29 04 41",
      items: [
        {
          type: "box",
          flavor: "gOfIo",
          qty: 2,
        },
      ],
    }
  )
})

test("mapea un pedido manual con varias tartas a varios order_items", () => {
  assert.deepEqual(
    buildManualOrderPayload({
      customerName: "Ana",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      notes: "  Llama al llegar  ",
      items: [
        {
          format: "tarta",
          flavor: "lotus",
          quantity: 1,
        },
        {
          format: "cajita",
          flavor: " pistacho ",
          quantity: 3,
        },
      ],
    }),
    {
      delivery_date: "2026-05-12",
      status: "pending",
      skip_lead_days: true,
      customer_name: "Ana",
      phone: "600000000",
      notes: "Llama al llegar",
      items: [
        {
          type: "cake",
          flavor: "lotus",
          qty: 1,
        },
        {
          type: "box",
          flavor: "pistacho",
          qty: 3,
        },
      ],
    }
  )
})

test("valida y bloquea un item manual incompleto", () => {
  const form: ManualOrderFormValues = {
    customerName: "Ana",
    phone: "600000000",
    deliveryDate: "2026-05-12",
    notes: "",
    items: [
      {
        format: "",
        flavor: "",
        quantity: 1,
      },
    ],
  }

  const errors = validateManualOrderForm(form)

  assert.equal(hasManualOrderValidationErrors(errors), true)
  assert.equal(errors["items.0.format"], "Falta el tamaño")
  assert.equal(errors["items.0.flavor"], "Falta el sabor")
  assert.throws(() => buildManualOrderPayload(form), /Falta el tamaño/)
})
