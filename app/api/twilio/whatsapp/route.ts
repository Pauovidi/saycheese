import { NextResponse } from "next/server"

import { handleMessage } from "@/lib/chatbot/engine"
import { claimInboundWhatsappMessage } from "@/lib/chatbot/memory"
import { handleTwilioWhatsappPost } from "@/lib/twilio/whatsapp-webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ ok: true, provider: "twilio", channel: "whatsapp" })
}

export async function POST(request: Request) {
  return handleTwilioWhatsappPost(request, handleMessage, { claimMessageSid: claimInboundWhatsappMessage })
}
