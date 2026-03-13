import test from "node:test"
import assert from "node:assert/strict"

import { buildMissingFieldsPrompt } from "../lib/chatbot/order-prompts"

test("pide solo el teléfono una vez cuando es el único dato faltante", () => {
  assert.equal(
    buildMissingFieldsPrompt({
      flavor: "pistacho",
      format: "tarta",
    }),
    "Necesito tu teléfono para confirmar el pedido."
  )
})

test("compone un único mensaje coherente cuando faltan varios campos", () => {
  assert.equal(
    buildMissingFieldsPrompt({}),
    "Me falta sabor, formato (grande o cajita) y teléfono para confirmar el pedido."
  )
})

test("no duplica campos aunque el helper se evalúe varias veces sobre el mismo estado", () => {
  assert.equal(
    buildMissingFieldsPrompt({
      flavor: "lotus",
    }),
    "Me falta formato (grande o cajita) y teléfono para confirmar el pedido."
  )
})
