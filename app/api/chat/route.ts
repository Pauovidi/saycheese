import { randomUUID } from "crypto"

import { NextResponse } from "next/server"
import { z } from "zod"

import { handleMessage } from "@/lib/chatbot/engine"

const chatSchema = z.object({
  external_id: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  message: z.string().min(1),
  phone: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const payload = chatSchema.parse(await request.json())
    const externalId = payload.external_id ?? payload.sessionId ?? randomUUID()

    const result = await handleMessage({
      sessionId: externalId,
      message: payload.message,
      phone: payload.phone,
      channel: "web",
    })

    return NextResponse.json({ ok: true, reply: result.text, handoff: result.handoff, external_id: externalId })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
