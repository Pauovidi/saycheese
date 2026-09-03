import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

import { buildStoreHoursReplyIfIntent } from "../lib/chatbot/hours"
import { STORE_HOURS_TEXT, STORE_PICKUP_HOURS_TEXT } from "../src/data/business"
import { faqs } from "../src/data/faqs"

const questions = [
  "¿Cuál es el horario?",
  "¿A qué hora abre la tienda?",
  "¿A qué hora cierra la tienda?",
  "Hola, ¿cuándo abrís?",
  "¿Cuándo cierran?",
  "¿Estáis abiertos el domingo?",
  "¿Los lunes está cerrado?",
  "Hora de apertura y cierre",
  "¿Hasta qué hora puedo recoger mi pedido?",
  "¿A qué hora puedo pasar a buscar la tarta?",
  "¿Qué días puedo recoger?",
  "Horario de recogida de mi pedido",
]

test("responde preguntas de apertura, cierre y recogida con el horario exacto de los FAQ", () => {
  const faq = faqs.find(({ question }) => /horario/i.test(question))
  assert.ok(faq)
  for (const question of questions) {
    assert.equal(buildStoreHoursReplyIfIntent(question), faq.answer, question)
  }
})

test("las confirmaciones conservan todos los turnos y los días cerrados de los FAQ", () => {
  const expected = [
    "Miércoles: 16:30–20:30",
    "Jueves: 16:30–20:30",
    "Viernes: 16:30–20:30",
    "Sábado: 10:00–14:00 y 16:30–20:30",
    "Domingo: 10:00–14:00",
    "Lunes y martes: cerrado.",
  ]
  for (const line of expected) {
    assert.ok(STORE_HOURS_TEXT.includes(line), line)
    assert.ok(STORE_PICKUP_HOURS_TEXT.includes(line), line)
  }
})

test("no confunde fechas, sabores o cerrar un pedido con consultar horarios", () => {
  for (const message of ["jueves", "pues ese", "quiero una tarta para el domingo", "qué sabores hay", "cerrar pedido", "cierra el pedido", "pedido cerrado", "nada más", "me llamo Ana"]) {
    assert.equal(buildStoreHoursReplyIfIntent(message), null, message)
  }
})

test("el horario se atiende antes que ubicación o consultas de pedidos sin modificar el pedido en curso", async () => {
  const source = await readFile(resolve("lib/chatbot/engine.ts"), "utf8")
  const hoursIndex = source.indexOf("const hoursReply = buildStoreHoursReplyIfIntent(message)")
  const locationIndex = source.indexOf("const locationReply = buildStoreLocationReplyIfIntent(message)")
  assert.ok(hoursIndex >= 0 && hoursIndex < locationIndex)
  const hoursBranch = source.slice(hoursIndex, locationIndex)
  assert.match(hoursBranch, /return saveAndReply\(userId, hoursReply\)/)
  assert.doesNotMatch(hoursBranch, /resetOrderState|persistOrderState|createChatOrder/)
})

test("la confirmación web muestra el horario con saltos de línea antes de los enlaces de salida", async () => {
  const source = await readFile(resolve("src/components/checkout-summary.tsx"), "utf8")
  const confirmation = source.slice(source.indexOf("if (confirmation)"), source.indexOf("if (items.length === 0)"))
  assert.match(confirmation, /whitespace-pre-line[^>]*>\{STORE_PICKUP_HOURS_TEXT\}/)
})
