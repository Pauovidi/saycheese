import test from "node:test"
import assert from "node:assert/strict"

import { buildManualOrderPayload } from "../lib/admin/manual-order"

test("mapea el formulario manual al modelo real de pedido", () => {
  assert.deepEqual(
    buildManualOrderPayload({
      customerName: "  Pau Ovidi  ",
      phone: " +34 645 29 04 41 ",
      deliveryDate: "2026-05-02",
      format: "cajita",
      flavor: " gOfIo ",
      quantity: 2,
    }),
    {
      delivery_date: "2026-05-02",
      status: "pending",
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
