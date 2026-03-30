import { NextResponse } from "next/server"

import { handleMessage } from "@/lib/chatbot/engine"
import { serializeErrorForLog, writeStructuredLog } from "@/lib/diagnostics/structured-log"
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

function getProcessingTimeMs(startedAt: number) {
  return Number((performance.now() - startedAt).toFixed(2))
}

export async function POST(request: Request) {
  const startedAt = performance.now()

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
        writeStructuredLog("warn", "twilio-whatsapp-webhook", "signature_missing", {
          hasAuthToken: Boolean(authToken),
          hasSignature: Boolean(twilioSignature),
          messageSid: messageSid || null,
          processingTimeMs: getProcessingTimeMs(startedAt),
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
        writeStructuredLog("warn", "twilio-whatsapp-webhook", "signature_invalid", {
          messageSid: messageSid || null,
          from: maskPhone(from),
          processingTimeMs: getProcessingTimeMs(startedAt),
        })

        return new NextResponse("forbidden", { status: 403 })
      }
    }

    writeStructuredLog("info", "twilio-whatsapp-webhook", "inbound_received", {
      messageSid: messageSid || null,
      userId: normalizedUserId || null,
      from: maskPhone(from),
      to: maskPhone(to),
      hasBody: body.length > 0,
      bodyLength: body.length,
      contentType,
      signaturePresent: Boolean(twilioSignature),
      signatureEnforced: shouldEnforceTwilioSignature(),
      processingTimeMs: getProcessingTimeMs(startedAt),
    })

    if (!normalizedUserId) {
      writeStructuredLog("warn", "twilio-whatsapp-webhook", "missing_normalized_user_id", {
        messageSid: messageSid || null,
        from: maskPhone(from),
        processingTimeMs: getProcessingTimeMs(startedAt),
      })
      writeStructuredLog("info", "twilio-whatsapp-webhook", "reply_generated", {
        messageSid: messageSid || null,
        replyLength: ERROR_FALLBACK_REPLY.length,
        replyPreview: buildReplyPreview(ERROR_FALLBACK_REPLY),
        replyType: "missing_user_id_fallback",
        processingTimeMs: getProcessingTimeMs(startedAt),
      })

      return createTwilioXmlResponse(createTwilioMessagingResponse(ERROR_FALLBACK_REPLY))
    }

    if (!body.trim()) {
      writeStructuredLog("info", "twilio-whatsapp-webhook", "reply_generated", {
        messageSid: messageSid || null,
        userId: normalizedUserId,
        replyLength: EMPTY_MESSAGE_REPLY.length,
        replyPreview: buildReplyPreview(EMPTY_MESSAGE_REPLY),
        replyType: "empty_body_fallback",
        processingTimeMs: getProcessingTimeMs(startedAt),
      })

      return createTwilioXmlResponse(createTwilioMessagingResponse(EMPTY_MESSAGE_REPLY))
    }

    const result = await handleMessage({
      sessionId: normalizedUserId,
      message: body,
      phone: normalizedUserId,
      channel: "whatsapp",
    })

    writeStructuredLog("info", "twilio-whatsapp-webhook", "reply_generated", {
      messageSid: messageSid || null,
      userId: normalizedUserId,
      replyLength: result.text.length,
      replyPreview: buildReplyPreview(result.text),
      handoff: Boolean(result.handoff),
      processingTimeMs: getProcessingTimeMs(startedAt),
    })

    return createTwilioXmlResponse(createTwilioMessagingResponse(result.text))
  } catch (error) {
    writeStructuredLog("error", "twilio-whatsapp-webhook", "unexpected_error", {
      processingTimeMs: getProcessingTimeMs(startedAt),
      error: serializeErrorForLog(error),
    })
    writeStructuredLog("info", "twilio-whatsapp-webhook", "reply_generated", {
      replyLength: ERROR_FALLBACK_REPLY.length,
      replyPreview: buildReplyPreview(ERROR_FALLBACK_REPLY),
      replyType: "error_fallback",
      processingTimeMs: getProcessingTimeMs(startedAt),
    })

    return createTwilioXmlResponse(createTwilioMessagingResponse(ERROR_FALLBACK_REPLY))
  }
}
