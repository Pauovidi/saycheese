import test from "node:test"
import assert from "node:assert/strict"

import {
  buildWebOrderWhatsappConfirmationMessage,
  sendWebOrderWhatsappConfirmation,
  type SendWebOrderWhatsappConfirmationDeps,
} from "../lib/chatbot/whatsapp-confirmation"
import { normalizeSpanishWhatsappDestination, sendTwilioWhatsAppTemplate } from "../lib/twilio/client"
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

const twilioTemplateEnv = {
  ...twilioEnv,
  TWILIO_ORDER_CONFIRMATION_CONTENT_SID: "HX_order_confirmation",
}

type SentInput = Parameters<NonNullable<SendWebOrderWhatsappConfirmationDeps["send"]>>[0]

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

test("cliente Twilio envía Content Template con ContentSid y ContentVariables sin Body", async () => {
  const previousEnv = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM,
    TWILIO_ORDER_CONFIRMATION_CONTENT_SID: process.env.TWILIO_ORDER_CONFIRMATION_CONTENT_SID,
  }
  const originalFetch = globalThis.fetch
  let postedBody: URLSearchParams | undefined

  try {
    process.env.TWILIO_ACCOUNT_SID = "AC_test"
    process.env.TWILIO_AUTH_TOKEN = "token"
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886"
    process.env.TWILIO_ORDER_CONFIRMATION_CONTENT_SID = "HX_order_confirmation"
    globalThis.fetch = (async (_url, init) => {
      postedBody = init?.body as URLSearchParams
      return new Response(JSON.stringify({ sid: "SM_template" }), { status: 201 })
    }) as typeof fetch

    const result = await sendTwilioWhatsAppTemplate({
      to: "whatsapp:+34600000000",
      contentSid: "HX_order_confirmation",
      contentVariables: {
        "1": "tarta grande de Lotus",
        "2": "Recogida en tienda el 12/05/2026",
      },
    })

    assert.equal(result.sid, "SM_template")
    assert.ok(postedBody)
    assert.equal(postedBody.get("From"), "whatsapp:+14155238886")
    assert.equal(postedBody.get("To"), "whatsapp:+34600000000")
    assert.equal(postedBody.get("ContentSid"), "HX_order_confirmation")
    assert.deepEqual(JSON.parse(postedBody.get("ContentVariables") ?? "{}"), {
      "1": "tarta grande de Lotus",
      "2": "Recogida en tienda el 12/05/2026",
    })
    assert.equal(postedBody.has("Body"), false)
  } finally {
    globalThis.fetch = originalFetch
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})

test("con Twilio faltante y Meta presente usa Meta", async () => {
  const sent: SentInput[] = []
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
  const first = sent[0]
  assert.equal(first?.provider, "meta")
  if (first?.provider !== "meta") assert.fail("expected Meta send")
  assert.equal(first.to, "34600000000")
  assert.match(first.body, /Pedido confirmado/i)
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
    provider: "meta",
    hasTwilioSid: false,
    hasTwilioToken: false,
    hasTwilioFrom: false,
    hasTwilioContentSid: false,
    hasMetaToken: true,
    hasPhoneNumberId: true,
    hasOrderConfirmationTemplate: true,
  })
})

test("con Twilio configurado y Content SID usa template aunque falte Meta", async () => {
  const sent: SentInput[] = []
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
      env: twilioTemplateEnv,
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
  const first = sent[0]
  assert.equal(first?.provider, "twilio")
  if (first?.provider !== "twilio") assert.fail("expected Twilio send")
  assert.equal(first.to, "whatsapp:+34600000000")
  assert.equal("body" in first, false)
  assert.equal(first.template.contentSid, "HX_order_confirmation")
  assert.deepEqual(first.template.contentVariables, {
    "1": "tarta grande de Lotus",
    "2": "Recogida en tienda el 12/05/2026",
  })
})

test("con Twilio y Meta presentes usa Twilio como proveedor principal", async () => {
  const sent: SentInput[] = []
  const { events, logger } = createLogger()

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-twilio-primary",
      channel: "web",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
    },
    {
      env: { ...metaTemplateEnv, ...twilioTemplateEnv },
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
  const first = sent[0]
  assert.equal(first?.provider, "twilio")
  if (first?.provider !== "twilio") assert.fail("expected Twilio send")
  assert.equal(first.to, "whatsapp:+34600000000")
  assert.equal("body" in first, false)

  const attempt = events.find((event) => event.args[0] === "whatsapp_confirmation_attempt")
  assert.ok(attempt)
  assert.equal((attempt.args[1] as { provider?: string }).provider, "twilio")
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

test("fallo de Twilio marca failed y queda logueado sin lanzar error", async () => {
  const { events, logger } = createLogger()
  let failed = false
  let savedError = ""

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-4",
      channel: "web",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
    },
    {
      env: twilioTemplateEnv,
      logger,
      reserve: async () => ({ ok: true }),
      markFailed: async (input) => {
        failed = true
        savedError = input.error instanceof Error ? input.error.message : String(input.error)
      },
      send: async () => {
        throw new Error("Twilio WhatsApp error 400 code=63016: Outside messaging window")
      },
    }
  )

  assert.equal(result.ok, false)
  assert.equal(failed, true)
  assert.match(savedError, /63016/)
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

test("si Twilio está configurado pero falta Content SID marca failed y no envía body libre", async () => {
  const { events, logger } = createLogger()
  let reservationProvider = ""
  let failedError = ""
  let sent = false

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-twilio-missing-content-sid",
      channel: "web",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
    },
    {
      env: { ...twilioEnv, WHATSAPP_TEMPLATE_ORDER_CONFIRMATION_NAME: "order_confirmation" },
      logger,
      reserve: async (input) => {
        reservationProvider = input.provider
        return { ok: true }
      },
      markFailed: async (input) => {
        failedError = input.error instanceof Error ? input.error.message : String(input.error)
      },
      send: async () => {
        sent = true
        return { sid: "SM_should_not_send" }
      },
    }
  )

  assert.deepEqual(result, { ok: true, skipped: "disabled" })
  assert.equal(reservationProvider, "twilio")
  assert.equal(sent, false)
  assert.match(failedError, /TWILIO_ORDER_CONFIRMATION_CONTENT_SID/)
  assert.match(failedError, /Content SID|Content Template/i)
  assert.equal(events.some((event) => event.args[0] === "whatsapp_confirmation_skipped_disabled"), true)
})

test("sin proveedores reserva fila y marca failed", async () => {
  const { events, logger } = createLogger()
  let called = false
  let reserved = false
  let failed = false
  let reservationTo = ""
  let reservationProvider = ""

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
      reserve: async (input) => {
        reserved = true
        reservationTo = input.to
        reservationProvider = input.provider
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
  assert.equal(reservationTo, "whatsapp:+34600000000")
  assert.equal(reservationProvider, "disabled")
  assert.equal(events.some((event) => event.args[0] === "whatsapp_confirmation_skipped_disabled"), true)

  const attempt = events.find((event) => event.args[0] === "whatsapp_confirmation_attempt")
  assert.ok(attempt)
  assert.equal((attempt.args[1] as { provider?: string }).provider, "disabled")
})

test("pedido chatbot web crea intento sent vía Twilio template mock", async () => {
  const rows = new Map<string, { status: "pending" | "sent" | "failed"; to: string; provider: string; sid?: string }>()
  const { logger } = createLogger()

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-web-chatbot-twilio",
      channel: "web",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      items: [{ type: "cake", flavor: "Lotus", qty: 1 }],
    },
    {
      env: twilioTemplateEnv,
      logger,
      reserve: async (input) => {
        rows.set(input.orderId, { status: "pending", to: input.to, provider: input.provider })
        return { ok: true }
      },
      markSent: async (input) => {
        const row = rows.get(input.orderId)
        if (!row) throw new Error("missing reserved confirmation row")
        row.status = "sent"
        row.sid = input.sid
        row.provider = input.provider
      },
      markFailed: async (input) => {
        const row = rows.get(input.orderId)
        if (!row) throw new Error("missing reserved confirmation row")
        row.status = "failed"
      },
      send: async (input) => {
        assert.equal(input.provider, "twilio")
        if (input.provider !== "twilio") assert.fail("expected Twilio template send")
        assert.equal("body" in input, false)
        assert.equal(input.template.contentSid, "HX_order_confirmation")
        assert.deepEqual(input.template.contentVariables, {
          "1": "tarta grande de Lotus",
          "2": "Recogida en tienda el 12/05/2026",
        })
        return { sid: "SM_web_chatbot" }
      },
    }
  )

  const row = rows.get("order-web-chatbot-twilio")
  assert.equal(result.ok, true)
  assert.equal(row?.status, "sent")
  assert.equal(row?.to, "whatsapp:+34600000000")
  assert.equal(row?.provider, "twilio")
  assert.equal(row?.sid, "SM_web_chatbot")
})

test("pedido checkout web crea intento con provider Twilio template", async () => {
  let reservationProvider = ""
  let sentProvider = ""
  let sentContentSid = ""
  const { logger } = createLogger()

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-checkout-web-twilio-template",
      channel: "web",
      phone: "600000000",
      deliveryDate: "2026-05-13",
      items: [{ type: "box", flavor: "Clásica", qty: 1 }],
    },
    {
      env: twilioTemplateEnv,
      logger,
      reserve: async (input) => {
        reservationProvider = input.provider
        return { ok: true }
      },
      markSent: async (input) => {
        sentProvider = input.provider
      },
      send: async (input) => {
        assert.equal(input.provider, "twilio")
        if (input.provider !== "twilio") assert.fail("expected Twilio template send")
        sentContentSid = input.template.contentSid
        return { sid: "SM_checkout_web" }
      },
    }
  )

  assert.equal(result.ok, true)
  assert.equal(reservationProvider, "twilio")
  assert.equal(sentProvider, "twilio")
  assert.equal(sentContentSid, "HX_order_confirmation")
})

test("Twilio template conserva resumen multi-item en variables", async () => {
  let contentVariables: Record<string, string> | undefined
  const { logger } = createLogger()

  const result = await sendWebOrderWhatsappConfirmation(
    {
      orderId: "order-twilio-template-multi-item",
      channel: "web",
      phone: "600000000",
      deliveryDate: "2026-05-12",
      items: [
        { type: "cake", flavor: "Lotus", qty: 2 },
        { type: "box", flavor: "Pistacho", qty: 1 },
      ],
    },
    {
      env: twilioTemplateEnv,
      logger,
      reserve: async () => ({ ok: true }),
      markSent: async () => {},
      send: async (input) => {
        assert.equal(input.provider, "twilio")
        if (input.provider !== "twilio") assert.fail("expected Twilio template send")
        contentVariables = input.template.contentVariables
        return { sid: "SM_multi" }
      },
    }
  )

  assert.equal(result.ok, true)
  assert.deepEqual(contentVariables, {
    "1": "tarta grande de Lotus x2, cajita de Pistacho",
    "2": "Recogida en tienda el 12/05/2026",
  })
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
