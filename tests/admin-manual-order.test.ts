import test from "node:test"
import assert from "node:assert/strict"

import {
  buildManualOrderPayload,
  hasManualOrderValidationErrors,
  validateManualOrderForm,
  type ManualOrderFormValues,
} from "../lib/admin/manual-order"
import {
  createInitialManualOrderForm,
  manualOrderDialogContentClass,
  manualOrderDialogFooterClass,
  manualOrderDialogHeaderClass,
  manualOrderDialogScrollBodyClass,
  shouldConfirmManualOrderCancel,
  shouldPreventManualOrderOverlayDismiss,
} from "../lib/admin/manual-order-dialog-state"

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

test("modal con varias tartas mantiene el cuerpo scrolleable y guardar accesible", () => {
  assert.match(manualOrderDialogContentClass, /max-h-\[90vh\]/)
  assert.match(manualOrderDialogContentClass, /overflow-hidden/)
  assert.match(manualOrderDialogScrollBodyClass, /flex-1/)
  assert.match(manualOrderDialogScrollBodyClass, /overflow-y-auto/)
  assert.match(manualOrderDialogFooterClass, /sticky/)
  assert.match(manualOrderDialogFooterClass, /bottom-0/)
  assert.match(manualOrderDialogFooterClass, /shrink-0/)
  assert.match(manualOrderDialogHeaderClass, /sticky/)
})

test("overlay click no descarta el formulario del pedido manual", () => {
  assert.equal(shouldPreventManualOrderOverlayDismiss(), true)
})

test("cancelar con datos introducidos pide confirmación antes de descartar", () => {
  const pristine = createInitialManualOrderForm("lotus")
  assert.equal(shouldConfirmManualOrderCancel(pristine, "lotus"), false)

  assert.equal(
    shouldConfirmManualOrderCancel(
      {
        ...pristine,
        customerName: "Ana",
      },
      "lotus"
    ),
    true
  )

  assert.equal(
    shouldConfirmManualOrderCancel(
      {
        ...pristine,
        items: [
          ...pristine.items,
          {
            format: "cajita",
            flavor: "pistacho",
            quantity: 2,
          },
        ],
      },
      "lotus"
    ),
    true
  )
})
