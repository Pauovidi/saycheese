import { randomUUID } from "crypto"

import { NextResponse } from "next/server"
import { z } from "zod"

import {
  buildChatApiErrorResponse,
  buildChatApiSuccessResponse,
  type ChatApiResponse,
} from "@/lib/chatbot/chat-api-error"
import { handleMessage } from "@/lib/chatbot/engine"

const chatSchema = z.object({
  external_id: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  message: z.string().min(1),
  phone: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const payload = chatSchema.safeParse(await request.json())
    if (!payload.success) {
      return NextResponse.json<ChatApiResponse>(
        {
          ok: false,
          error: "Solicitud de chat no válida.",
        },
        { status: 400 }
      )
    }
    const externalId = payload.data.external_id ?? payload.data.sessionId ?? randomUUID()

    const result = await handleMessage({
      sessionId: externalId,
      message: payload.data.message,
      phone: payload.data.phone,
      channel: "web",
    })

    return NextResponse.json<ChatApiResponse>(buildChatApiSuccessResponse(result.text, externalId))
  } catch (error) {
    const { status, body } = buildChatApiErrorResponse(error)

    console.error({
      where: "/api/chat",
      status,
      debug: body.debug,
      error: error instanceof Error ? error.message : error,
    })

    return NextResponse.json<ChatApiResponse>(body, { status })
  }
}
