import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

test("cerrar pedido desde chatbot web registra orden y dispara confirmación WhatsApp", async () => {
  const engineSource = await readFile(resolve("lib/chatbot/engine.ts"), "utf8")
  const finalizeIndex = engineSource.indexOf("async function finalizeOrderFromState")
  const finalizeLogIndex = engineSource.indexOf('path: "finalizeOrderFromState"', finalizeIndex)
  const finalizeConfirmationIndex = engineSource.indexOf("await sendWebOrderWhatsappConfirmation", finalizeIndex)
  const createdReplyIndex = engineSource.indexOf("Pedido creado ✅", finalizeIndex)

  assert.notEqual(finalizeIndex, -1)
  assert.notEqual(finalizeLogIndex, -1)
  assert.notEqual(finalizeConfirmationIndex, -1)
  assert.notEqual(createdReplyIndex, -1)
  assert.equal(finalizeLogIndex < finalizeConfirmationIndex, true)
  assert.equal(finalizeConfirmationIndex < createdReplyIndex, true)
})

test("tool runner create_order del chatbot también dispara confirmación WhatsApp", async () => {
  const engineSource = await readFile(resolve("lib/chatbot/engine.ts"), "utf8")
  const toolRunnerIndex = engineSource.indexOf('if (name === "create_order")')
  const toolLogIndex = engineSource.indexOf('path: "toolRunner.create_order"', toolRunnerIndex)
  const toolConfirmationIndex = engineSource.indexOf("await sendWebOrderWhatsappConfirmation", toolRunnerIndex)

  assert.notEqual(toolRunnerIndex, -1)
  assert.notEqual(toolLogIndex, -1)
  assert.notEqual(toolConfirmationIndex, -1)
  assert.equal(toolLogIndex < toolConfirmationIndex, true)
})
