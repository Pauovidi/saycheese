export type ChatApiError = Error & {
  status?: number
  code?: string
}

export type ChatApiResponse = {
  ok: boolean
  reply?: string
  error?: string
  external_id?: string
  debug?: {
    status?: number
    code?: string
  }
}

type ChatApiErrorResult = {
  status: number
  body: ChatApiResponse
}

function createChatApiError(message: string) {
  return new Error(message) as ChatApiError
}

export function normalizeChatApiError(error: unknown): ChatApiError {
  if (error instanceof Error) {
    const normalized = error as ChatApiError
    const unknownError = error as unknown as Record<string, unknown>

    if (typeof unknownError.status === "number") {
      normalized.status = unknownError.status
    }

    if (typeof unknownError.code === "string") {
      normalized.code = unknownError.code
    }

    return normalized
  }

  return createChatApiError(typeof error === "string" ? error : "Error interno")
}

function buildDebugPayload(error: ChatApiError) {
  const debug: { status?: number; code?: string } = {}

  if (typeof error.status === "number") {
    debug.status = error.status
  }

  if (typeof error.code === "string") {
    debug.code = error.code
  }

  return Object.keys(debug).length ? debug : undefined
}

function isMissingOpenAIKey(error: ChatApiError) {
  return /OPENAI_API_KEY/i.test(error.message)
}

export function buildChatApiSuccessResponse(reply: string, externalId: string): ChatApiResponse {
  return {
    ok: true,
    reply,
    external_id: externalId,
  }
}

export function buildChatApiErrorResponse(error: unknown): ChatApiErrorResult {
  const normalizedError = normalizeChatApiError(error)
  const debug = buildDebugPayload(normalizedError)

  if (isMissingOpenAIKey(normalizedError) || normalizedError.status === 401 || normalizedError.status === 403) {
    return {
      status: 503,
      body: {
        ok: false,
        error: "Servicio temporalmente no disponible.",
        ...(debug ? { debug } : {}),
      },
    }
  }

  if (normalizedError.status === 429) {
    return {
      status: 200,
      body: {
        ok: true,
        reply: "Ahora mismo hay muchas consultas o el servicio está limitado. Prueba en 30–60 segundos.",
        ...(debug ? { debug } : {}),
      },
    }
  }

  if (normalizedError.status === 400) {
    return {
      status: 200,
      body: {
        ok: true,
        reply: "No pude procesar esa solicitud. ¿Puedes repetirlo de otra forma?",
        ...(debug ? { debug } : {}),
      },
    }
  }

  return {
    status: 500,
    body: {
      ok: false,
      error: "Error interno. Inténtalo en un minuto.",
      ...(debug ? { debug } : {}),
    },
  }
}
