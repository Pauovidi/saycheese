import assert from "node:assert/strict"
import test from "node:test"

import { computeReminderAt } from "../lib/chatbot/reminders"

test("calcula el recordatorio 24 horas antes cuando la fecha de recogida es explícita", () => {
  const reminderAt = computeReminderAt({
    createdAt: new Date("2026-04-20T09:30:00.000Z"),
    deliveryDate: "2026-04-23",
    usedDefaultDeliveryDate: false,
  })

  assert.equal(reminderAt, "2026-04-22T09:30:00.000Z")
})

test("mantiene la ruta legacy de 48 horas cuando el pedido usa fecha por defecto", () => {
  const reminderAt = computeReminderAt({
    createdAt: new Date("2026-04-20T09:30:00.000Z"),
    deliveryDate: "2026-04-23",
    usedDefaultDeliveryDate: true,
  })

  assert.equal(reminderAt, "2026-04-22T09:30:00.000Z")
})
