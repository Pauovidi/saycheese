import { NextResponse } from "next/server"

import { handleMessage } from "@/lib/chatbot/engine"
import { validateTwilioSignature } from "@/lib/twilio/signature"
import { createTwilioMessagingResponse, createTwilioXmlResponse } from "@/lib/twilio/twiml"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

function maskPhone(value: string) {
  if (!value) return ""
  if (value.length <= 6) return "***"

  return `${value.slice(0, 4)}***${value.slice(-2)}`
}

function buildReplyPreview(value: string) {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value
}

function shouldEnforceTwilioSignature() {
  return process.env.TWILIO_VALIDATE_SIGNATURE === "true"
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? ""
    const formData = await request.formData()

    const body = readFormValue(formData, "Body")
    const from = readFormValue(formData, "From")
    const to = readFormValue(formData, "To")
    const messageSid = readFormValue(formData, "MessageSid")
    const twilioSignature = request.headers.get("x-twilio-signature") ?? ""
    const normalizedUserId = normalizeWhatsappUserId(from)

    if (shouldEnforceTwilioSignature()) {
      const authToken = process.env.TWILIO_AUTH_TOKEN

      if (!authToken || !twilioSignature) {
        console.warn("[twilio-whatsapp] missing signature data", {
          hasAuthToken: Boolean(authToken),
          hasSignature: Boolean(twilioSignature),
          messageSid: messageSid || null,
        })

        return new NextResponse("forbidden", { status: 403 })
      }

      const isValid = validateTwilioSignature({
        authToken,
        formData,
        requestUrl: request.url,
        signature: twilioSignature,
      })

      if (!isValid) {
        console.warn("[twilio-whatsapp] invalid signature", {
          messageSid: messageSid || null,
          from: maskPhone(from),
        })

        return new NextResponse("forbidden", { status: 403 })
      }
    }

    console.info("[twilio-whatsapp] inbound message", {
      messageSid: messageSid || null,
      userId: normalizedUserId || null,
      from: maskPhone(from),
      to: maskPhone(to),
      hasBody: body.length > 0,
      bodyLength: body.length,
      contentType,
      signaturePresent: Boolean(twilioSignature),
      signatureEnforced: shouldEnforceTwilioSignature(),
    })

    if (!normalizedUserId) {
      console.warn("[twilio-whatsapp] missing normalized user id", {
        messageSid: messageSid || null,
        from: maskPhone(from),
      })

      return createTwilioXmlResponse(createTwilioMessagingResponse(ERROR_FALLBACK_REPLY))
    }

    if (!body.trim()) {
      console.info("[twilio-whatsapp] empty body", {
        messageSid: messageSid || null,
        userId: normalizedUserId,
      })

      return createTwilioXmlResponse(createTwilioMessagingResponse(EMPTY_MESSAGE_REPLY))
    }

    const result = await handleMessage({
      sessionId: normalizedUserId,
      message: body,
      phone: normalizedUserId,
      channel: "whatsapp",
    })

    console.info("[twilio-whatsapp] generated reply", {
      messageSid: messageSid || null,
      userId: normalizedUserId,
      replyLength: result.text.length,
      replyPreview: buildReplyPreview(result.text),
      handoff: Boolean(result.handoff),
    })

    return createTwilioXmlResponse(createTwilioMessagingResponse(result.text))
  } catch (error) {
    console.error("[twilio-whatsapp] unexpected error", error)

    return createTwilioXmlResponse(createTwilioMessagingResponse(ERROR_FALLBACK_REPLY))
  }
}
