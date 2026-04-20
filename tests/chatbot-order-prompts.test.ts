import test from "node:test"
import assert from "node:assert/strict"

import { buildMissingFieldsPrompt } from "../lib/chatbot/order-prompts"

test("pide solo el teléfono una vez cuando es el único dato faltante", () => {
  assert.equal(
    buildMissingFieldsPrompt({
      flavor: "pistacho",
      format: "tarta",
      customerName: "Pau",
    }, "web"),
    "Solo me falta tu teléfono para confirmarlo."
  )
})

test("compone un único mensaje coherente cuando faltan varios campos", () => {
  assert.equal(
    buildMissingFieldsPrompt({}, "web"),
    "Para dejarlo confirmado necesito el sabor, el formato, tu nombre y tu teléfono."
  )
})

test("no duplica campos aunque el helper se evalúe varias veces sobre el mismo estado", () => {
  assert.equal(
    buildMissingFieldsPrompt({
      flavor: "lotus",
    }, "web"),
    "Para dejarlo confirmado necesito el formato, tu nombre y tu teléfono."
  )
})
