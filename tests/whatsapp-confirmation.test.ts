import test from "node:test"
import assert from "node:assert/strict"

import {
  buildWebOrderWhatsappConfirmationMessage,
  sendWebOrderWhatsappConfirmation,
} from "../lib/chatbot/whatsapp-confirmation"
import { normalizeSpanishWhatsappDestination } from "../lib/twilio/client"
import { normalizeSpanishMetaWhatsappRecipient } from "../lib/whatsapp/cloud-api"

const metaEnv = {
  WHATSAPP_ACCESS_TOKEN: "meta-token",
  WHATSAPP_PHONE_NUMBER_ID: "phone-number-id",
  WHATSAPP_TEMPLATE_LANG: "es_ES",
}

const metaTemplateEnv = {
  ...metaEnv,
  WHATSAPP_TEMPLATE_ORDER_CONFIRMATION_NAME: "order_confirmation",
}

const metaTemplateOnlyEnv = {
  WHATSAPP_TEMPLATE_LANG: "es_ES",
  WHATSAPP_TEMPLATE_ORDER_CONFIRMATION_NAME: "order_confirmation",
}

const twilioEnv = {
  TWILIO_ACCOUNT_SID: "AC_test",
  TWILIO_AUTH_TOKEN: "token",
  TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886",
}

function createLogger() {
  const events: Array<{ level: "info" | "error"; args: unknown[] }> = []
  return {
    events,
    logger: {
      info: (...args: unknown[]) => events.push({ level: "info", args }),
      error: (...args: unknown[]) => events.push({ level: "error", args }),
    },
  }
}

test("normaliza teléfonos españoles para destino Twilio WhatsApp", () => {
  assert.equal(normalizeSpanishWhatsappDestination("600000000"), "whatsapp:+34600000000")
  assert.equal(normalizeSpanishWhatsappDestination("+34600000000"), "whatsapp:+34600000000")
  assert.equal(normalizeSpanishWhatsappDestination("34 600 000 000"), "whatsapp:+34600000000")
  assert.equal(normalizeSpanishWhatsappDestination("123"), null)
})

test("normaliza teléfonos españoles para destino Meta WhatsApp", () => {
  assert.equal(normalizeSpanishMetaWhatsappRecipient("600000000"), "34600000000")
  assert.equal(normalizeSpanishMetaWhatsappRecipient("+34600000000"), "34600000000")
  assert.equal(normalizeSpanishMetaWhatsappRecipient("34 600 000 000"), "34600000000")
  assert.equal(normalizeSpanishMetaWhatsappRecipient("123"), null)
})

test("pedido web confirmado con teléfono válido intenta enviar WhatsApp por Meta en producción", async () => {
  const sent: Array<{ to: string; body: string; provider: string }> = []
  const { events, logger } = createLogger()

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-1",
      channel: "web",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
    },
    {
      env: metaTemplateEnv,
      logger,
      reserve: async () => ({ ok: true }),
      markSent: async () => {},
      send: async (input) => {
        sent.push(input)
        return { id: "wamid.123" }
      },
    }
  )

  assert.equal(result.ok, true)
  assert.equal(sent.length, 1)
  assert.equal(sent[0]?.to, "34600000000")
  assert.equal(sent[0]?.provider, "meta")
  assert.match(sent[0]?.body ?? "", /Pedido confirmado/i)
  assert.equal(events.some((event) => event.args[0] === "whatsapp_confirmation_sent"), true)
})

test("loguea diagnóstico seguro antes de reservar confirmación", async () => {
  const { events, logger } = createLogger()

  await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-diagnostics",
      channel: "web",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
    },
    {
      env: metaTemplateEnv,
      logger,
      reserve: async () => ({ ok: false, reason: "duplicate" }),
    }
  )

  const attempt = events.find((event) => event.args[0] === "whatsapp_confirmation_attempt")
  assert.ok(attempt)
  assert.deepEqual(attempt.args[1], {
    orderId: "order-diagnostics",
    channel: "web",
    hasPhone: true,
    hasMetaToken: true,
    hasPhoneNumberId: true,
    hasOrderConfirmationTemplate: true,
  })
})

test("usa Twilio como fallback solo cuando Meta no está configurado", async () => {
  const sent: Array<{ to: string; provider: string }> = []
  const { logger } = createLogger()

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-twilio",
      channel: "web",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
    },
    {
      env: twilioEnv,
      logger,
      reserve: async () => ({ ok: true }),
      markSent: async () => {},
      send: async (input) => {
        sent.push(input)
        return { sid: "SM123" }
      },
    }
  )

  assert.equal(result.ok, true)
  assert.equal(sent[0]?.to, "whatsapp:+34600000000")
  assert.equal(sent[0]?.provider, "twilio")
})

test("pedido web confirmado sin teléfono no envía y no rompe", async () => {
  const { events, logger } = createLogger()
  let called = false

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-2",
      channel: "web",
      phone: undefined,
      deliveryDate: "2026-05-12",
      items: [{ type: "box", flavor: "Pistacho", qty: 1 }],
    },
    {
      env: metaEnv,
      logger,
      send: async () => {
        called = true
        return {}
      },
    }
  )

  assert.deepEqual(result, { ok: true, skipped: "missing_phone" })
  assert.equal(called, false)
  assert.equal(events.some((event) => event.args[0] === "whatsapp_confirmation_skipped_missing_phone"), true)
})

test("pedido confirmado desde WhatsApp inbound no envía confirmación outbound extra", async () => {
  const { events, logger } = createLogger()
  let called = false
  let reserved = false

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-3",
      channel: "whatsapp",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      items: [{ type: "cake", flavor: "Gofio", qty: 1 }],
    },
    {
      env: metaTemplateEnv,
      logger,
      reserve: async () => {
        reserved = true
        return { ok: true }
      },
      send: async () => {
        called = true
        return {}
      },
    }
  )

  assert.deepEqual(result, { ok: true, skipped: "channel" })
  assert.equal(called, false)
  assert.equal(reserved, false)
  assert.equal(events.some((event) => event.args[0] === "whatsapp_confirmation_attempt"), true)
  assert.equal(events.some((event) => event.args[0] === "whatsapp_confirmation_skipped_channel"), true)
})

test("fallo del proveedor WhatsApp queda logueado y no lanza error", async () => {
  const { events, logger } = createLogger()

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-4",
      channel: "web",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
    },
    {
      env: metaTemplateEnv,
      logger,
      reserve: async () => ({ ok: true }),
      markFailed: async () => {},
      send: async () => {
        throw new Error("twilio down")
      },
    }
  )

  assert.equal(result.ok, false)
  assert.equal(events.some((event) => event.args[0] === "whatsapp_confirmation_failed"), true)
})

test("idempotencia evita enviar dos veces para el mismo pedido", async () => {
  const { events, logger } = createLogger()
  let called = false

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-5",
      channel: "web",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
    },
    {
      env: metaTemplateEnv,
      logger,
      reserve: async () => ({ ok: false, reason: "duplicate" }),
      send: async () => {
        called = true
        return {}
      },
    }
  )

  assert.deepEqual(result, { ok: true, skipped: "duplicate" })
  assert.equal(called, false)
  assert.equal(events.some((event) => event.args[0] === "whatsapp_confirmation_duplicate_skipped"), true)
})

test("mensaje incluye sabor, tamaño, fecha y recogida en tienda", () => {
  const message = buildWebOrderWhatsappConfirmationMessage({
    deliveryDate: "2026-05-12",
    items: [{ type: "box", flavor: "Pistacho", qty: 1 }],
  })

  assert.match(message, /Pedido confirmado/i)
  assert.match(message, /Pistacho/)
  assert.match(message, /cajita/)
  assert.match(message, /Recogida en tienda/)
  assert.match(message, /12\/05\/2026/)
})

test("mensaje de confirmación resume todos los items de un pedido multi-tarta", () => {
  const message = buildWebOrderWhatsappConfirmationMessage({
    deliveryDate: "2026-05-12",
    items: [
      { type: "cake", flavor: "Lotus", qty: 2 },
      { type: "box", flavor: "Pistacho", qty: 1 },
    ],
  })

  assert.match(message, /tarta grande de Lotus x2/)
  assert.match(message, /cajita de Pistacho/)
  assert.match(message, /12\/05\/2026/)
})

test("si faltan variables Twilio queda desactivado con log", async () => {
  const { events, logger } = createLogger()
  let called = false
  let reserved = false
  let failed = false

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-6",
      channel: "web",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
    },
    {
      env: {},
      logger,
      reserve: async () => {
        reserved = true
        return { ok: true }
      },
      markFailed: async () => {
        failed = true
      },
      send: async () => {
        called = true
        return {}
      },
    }
  )

  assert.deepEqual(result, { ok: true, skipped: "disabled" })
  assert.equal(called, false)
  assert.equal(reserved, true)
  assert.equal(failed, true)
  assert.equal(events.some((event) => event.args[0] === "whatsapp_confirmation_skipped_disabled"), true)
})

test("si Meta no tiene template reserva idempotencia y marca el intento como fallido", async () => {
  const { events, logger } = createLogger()
  let reserved = false
  let failed = false
  let sent = false

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-7",
      channel: "web",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
    },
    {
      env: metaEnv,
      logger,
      reserve: async () => {
        reserved = true
        return { ok: true }
      },
      markFailed: async () => {
        failed = true
      },
      send: async () => {
        sent = true
        return { id: "wamid.123" }
      },
    }
  )

  assert.deepEqual(result, { ok: true, skipped: "disabled" })
  assert.equal(reserved, true)
  assert.equal(failed, true)
  assert.equal(sent, false)
  assert.equal(events.some((event) => event.args[0] === "whatsapp_confirmation_meta_template_missing"), true)
  assert.equal(events.some((event) => event.args[0] === "whatsapp_confirmation_skipped_disabled"), true)
})

test("si Meta tiene template pero faltan token o phone number reserva antes de desactivar", async () => {
  const { events, logger } = createLogger()
  let reservationProvider = ""
  let failed = false
  let sent = false

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-meta-template-missing-credentials",
      channel: "web",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
    },
    {
      env: metaTemplateOnlyEnv,
      logger,
      reserve: async (input) => {
        reservationProvider = input.provider
        return { ok: true }
      },
      markFailed: async () => {
        failed = true
      },
      send: async () => {
        sent = true
        return { id: "wamid.123" }
      },
    }
  )

  assert.deepEqual(result, { ok: true, skipped: "disabled" })
  assert.equal(reservationProvider, "meta")
  assert.equal(failed, true)
  assert.equal(sent, false)
  assert.equal(events.some((event) => event.args[0] === "whatsapp_confirmation_meta_template_missing"), false)
  assert.equal(events.some((event) => event.args[0] === "whatsapp_confirmation_skipped_disabled"), true)
})
