import { NextResponse } from "next/server"

import { handleMessage } from "@/lib/chatbot/engine"

const GRAPH_API_BASE = "https://graph.facebook.com/v23.0"

function parseIncoming(payload: any) {
  const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
  if (!message) return null

  return {
    text: message.text?.body as string | undefined,
    waId: message.from as string | undefined,
  }
}

async function sendWhatsappText(to: string, body: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    throw new Error("Faltan variables de WhatsApp Cloud API")
  }

  const response = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      text: { body },
    }),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 })
  }

  return new NextResponse("forbidden", { status: 403 })
}

export async function POST(request: Request) {
  try {
    const incoming = parseIncoming(await request.json())

    if (!incoming?.text || !incoming.waId) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const response = await handleMessage({
      sessionId: incoming.waId,
      message: incoming.text,
      phone: incoming.waId,
      channel: "whatsapp",
    })

    await sendWhatsappText(incoming.waId, response.text)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
