import { NextResponse } from "next/server"
import { z } from "zod"

import { type ChatEngineError, handleMessage } from "@/lib/chatbot/engine"

const chatSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
  phone: z.string().optional(),
})

type ChatApiResponse = {
  ok: boolean
  reply: string
  debug?: {
    status?: number
    code?: string
  }
}

function normalizeError(error: unknown): ChatEngineError {
  if (error instanceof Error) {
    return error as ChatEngineError
  }
  return new Error(typeof error === "string" ? error : "Error interno") as ChatEngineError
}

export async function POST(request: Request) {
  try {
    const payload = chatSchema.parse(await request.json())
    const result = await handleMessage({
      sessionId: payload.sessionId,
      message: payload.message,
      phone: payload.phone,
      channel: "web",
    })

    return NextResponse.json<ChatApiResponse>({ ok: true, reply: result.text })
  } catch (error) {
    const normalizedError = normalizeError(error)
    const status = normalizedError.status
    const code = typeof normalizedError.code === "string" ? normalizedError.code : undefined

    console.error({
      where: "/api/chat",
      status,
      code,
      message: normalizedError.message,
      name: normalizedError.name,
      stack: normalizedError.stack,
    })

    if (normalizedError.message === "Missing OPENAI_API_KEY") {
      return NextResponse.json<ChatApiResponse>(
        {
          ok: false,
          reply: "Missing OPENAI_API_KEY",
        },
        { status: 500 },
      )
    }

    if (status === 429) {
      return NextResponse.json<ChatApiResponse>({
        ok: true,
        reply: "Ahora mismo hay muchas consultas o el servicio está limitado. Prueba en 30–60 segundos.",
        debug: { status: 429, ...(code ? { code } : {}) },
      })
    }

    if (status === 401) {
      return NextResponse.json<ChatApiResponse>({
        ok: true,
        reply: "Servicio no disponible (auth).",
        debug: { status: 401, ...(code ? { code } : {}) },
      })
    }

    if (status === 400) {
      return NextResponse.json<ChatApiResponse>({
        ok: true,
        reply: "No pude procesar esa solicitud.",
        debug: { status: 400, ...(code ? { code } : {}) },
      })
    }

    return NextResponse.json<ChatApiResponse>(
      {
        ok: false,
        reply: "Error interno. Inténtalo en un minuto.",
      },
      { status: 500 },
    )
  }
}
