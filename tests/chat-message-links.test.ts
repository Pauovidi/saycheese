import test from "node:test"
import assert from "node:assert/strict"

import { splitMessageLinks } from "../src/components/chat-message-links"

test("convierte el wa.me del handoff web en un segmento de enlace", () => {
  const parts = splitMessageLinks("Te atiende una persona del equipo aquí: https://wa.me/16414294476")

  assert.deepEqual(parts, [
    { type: "text", value: "Te atiende una persona del equipo aquí: " },
    { type: "link", value: "https://wa.me/16414294476" },
  ])
})

test("no altera mensajes sin urls", () => {
  assert.deepEqual(splitMessageLinks("He reiniciado la conversación. Te ayudo con un nuevo pedido."), [
    { type: "text", value: "He reiniciado la conversación. Te ayudo con un nuevo pedido." },
  ])
})
