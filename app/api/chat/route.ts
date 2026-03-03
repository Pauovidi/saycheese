import { NextResponse } from "next/server"
import { z } from "zod"

import { handleMessage } from "@/lib/chatbot/engine"

const chatSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
  phone: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const payload = chatSchema.parse(await request.json())
    const result = await handleMessage({
      sessionId: payload.sessionId,
      message: payload.message,
      phone: payload.phone,
      channel: "web",
    })

    return NextResponse.json({ ok: true, reply: result.text })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
