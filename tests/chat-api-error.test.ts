import test from "node:test"
import assert from "node:assert/strict"

import {
  buildChatApiErrorResponse,
  buildChatApiSuccessResponse,
  normalizeChatApiError,
} from "../lib/chatbot/chat-api-error"

test("normaliza errores con status y code para el endpoint de chat", () => {
  const source = Object.assign(new Error("rate limited"), {
    status: 429,
    code: "rate_limit_exceeded",
  })

  const normalized = normalizeChatApiError(source)

  assert.equal(normalized.status, 429)
  assert.equal(normalized.code, "rate_limit_exceeded")
})

test("devuelve fallback controlado cuando el proveedor responde 429", () => {
  const result = buildChatApiErrorResponse(
    Object.assign(new Error("Too many requests"), {
      status: 429,
      code: "rate_limit_exceeded",
    })
  )

  assert.equal(result.status, 200)
  assert.deepEqual(result.body, {
    ok: true,
    reply: "Ahora mismo hay muchas consultas o el servicio está limitado. Prueba en 30–60 segundos.",
    debug: {
      status: 429,
      code: "rate_limit_exceeded",
    },
  })
})

test("devuelve error controlado cuando falta OPENAI_API_KEY", () => {
  const result = buildChatApiErrorResponse(new Error("OPENAI_API_KEY no configurada"))

  assert.equal(result.status, 503)
  assert.deepEqual(result.body, {
    ok: false,
    error: "Servicio temporalmente no disponible.",
  })
})

test("mantiene el payload sano en el caso normal", () => {
  assert.deepEqual(buildChatApiSuccessResponse("Hola", "session-123"), {
    ok: true,
    reply: "Hola",
    external_id: "session-123",
  })
})
