import { NextResponse } from "next/server"

type ChatHandler = (input: {
  sessionId: string
  message: string
  phone: string
  channel: "whatsapp"
}) => Promise<{ text: string }>

const EMPTY_MESSAGE_REPLY = "Cuéntame qué necesitas y te respondo por aquí."
const ERROR_FALLBACK_REPLY =
  "Ahora mismo no puedo responderte. Si quieres, vuelve a escribir en unos minutos y te ayudamos por aquí."

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

function normalizeWhatsappUserId(value: string) {
  return value.replace(/^whatsapp:/i, "").replace(/\s+/g, "").trim()
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function createTwilioXmlResponse(message: string) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

export async function handleTwilioWhatsappPost(request: Request, handleMessage: ChatHandler) {
  try {
    const formData = await request.formData()
    const body = readFormValue(formData, "Body")
    const from = readFormValue(formData, "From")
    const normalizedUserId = normalizeWhatsappUserId(from)

    if (!normalizedUserId) {
      return createTwilioXmlResponse(ERROR_FALLBACK_REPLY)
    }

    if (!body.trim()) {
      return createTwilioXmlResponse(EMPTY_MESSAGE_REPLY)
    }

    const result = await handleMessage({
      sessionId: normalizedUserId,
      message: body,
      phone: normalizedUserId,
      channel: "whatsapp",
    })

    return createTwilioXmlResponse(result.text)
  } catch (error) {
    console.error("[twilio-whatsapp-webhook] unexpected_error", error)
    return createTwilioXmlResponse(ERROR_FALLBACK_REPLY)
  }
}
