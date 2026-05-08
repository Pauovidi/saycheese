import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

test("chatbot no ofrece ni acepta sabores expirados o despublicados", async () => {
  const productsSource = await readFile(resolve("lib/chatbot/products.ts"), "utf8")
  const ordersSource = await readFile(resolve("lib/chatbot/orders.ts"), "utf8")
  const engineSource = await readFile(resolve("lib/chatbot/engine.ts"), "utf8")
  const orderFlowSource = await readFile(resolve("lib/chatbot/order-flow.ts"), "utf8")

  assert.match(productsSource, /getCatalogProducts\(\)/)
  assert.match(productsSource, /findUnavailableFlavorByQuery/)
  assert.match(productsSource, /buildUnavailableFlavorMessage/)
  assert.match(ordersSource, /resolveFlavorAvailability/)
  assert.match(ordersSource, /buildUnavailableFlavorMessage/)
  assert.match(engineSource, /processOrderConversationTurn/)
  assert.match(orderFlowSource, /findUnavailableFlavorByQuery/)
})

test("checkout público y pedido manual validan disponibilidad antes de insertar", async () => {
  const apiSource = await readFile(resolve("app/api/orders/route.ts"), "utf8")
  const adminOrderSource = await readFile(resolve("actions/orders.ts"), "utf8")

  assert.match(apiSource, /resolveFlavorAvailability/)
  assert.match(apiSource, /buildUnavailableFlavorMessage/)
  assert.equal(apiSource.indexOf("resolveFlavorAvailability") < apiSource.indexOf(".from(\"orders\")"), true)
  assert.match(adminOrderSource, /resolveFlavorAvailability/)
  assert.equal(adminOrderSource.indexOf("resolveFlavorAvailability") < adminOrderSource.indexOf(".from(\"orders\")"), true)
})

test("checkout público reserva confirmación WhatsApp después de guardar el pedido", async () => {
  const apiSource = await readFile(resolve("app/api/orders/route.ts"), "utf8")
  const itemsInsertIndex = apiSource.indexOf(".from(\"order_items\")")
  const confirmationIndex = apiSource.indexOf("await sendWebOrderWhatsappConfirmation")
  const responseIndex = apiSource.lastIndexOf("return NextResponse.json({")

  assert.match(apiSource, /sendWebOrderWhatsappConfirmation/)
  assert.notEqual(itemsInsertIndex, -1)
  assert.notEqual(confirmationIndex, -1)
  assert.equal(itemsInsertIndex < confirmationIndex, true)
  assert.equal(confirmationIndex < responseIndex, true)
})
