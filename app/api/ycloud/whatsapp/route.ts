import { NextResponse } from "next/server"

import { handleMessage } from "@/lib/chatbot/engine"
import { validateYCloudSignature } from "@/lib/ycloud/signature"
import {
  buildReplyPreview,
  maskPhone,
  parseYCloudWhatsappWebhook,
  sendYCloudWhatsappText,
} from "@/lib/ycloud/whatsapp"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EMPTY_MESSAGE_REPLY = "Cuéntame qué necesitas y te respondo por aquí."
const ERROR_FALLBACK_REPLY =
  "Ahora mismo no puedo responderte. Si quieres, vuelve a escribir en unos minutos y te ayudamos por aquí."

function shouldEnforceYCloudSignature() {
  return process.env.YCLOUD_VALIDATE_SIGNATURE === "true"
}

function getYCloudSignatureToleranceSeconds() {
  const rawValue = Number.parseInt(process.env.YCLOUD_SIGNATURE_TOLERANCE_SECONDS ?? "300", 10)
  return Number.isFinite(rawValue) && rawValue >= 0 ? rawValue : 300
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? ""
  const signature = request.headers.get("ycloud-signature") ?? ""
  const webhookEndpointId = request.headers.get("x-webhook-endpoint-id") ?? ""
  let rawBody = ""

  try {
    rawBody = await request.text()

    if (shouldEnforceYCloudSignature()) {
      const secret = process.env.YCLOUD_WEBHOOK_SECRET?.trim()

      if (!secret || !signature) {
        console.warn("[ycloud-whatsapp] missing signature data", {
          hasSecret: Boolean(secret),
          hasSignature: Boolean(signature),
          endpointId: webhookEndpointId || null,
        })

        return new NextResponse("forbidden", { status: 403 })
      }

      const isValid = validateYCloudSignature({
        payload: rawBody,
        signatureHeader: signature,
        secret,
        toleranceSeconds: getYCloudSignatureToleranceSeconds(),
      })

      if (!isValid) {
        console.warn("[ycloud-whatsapp] invalid signature", {
          endpointId: webhookEndpointId || null,
        })

        return new NextResponse("forbidden", { status: 403 })
      }
    }

    const parsedWebhook = parseYCloudWhatsappWebhook(rawBody)

    if (parsedWebhook.kind === "invalid") {
      console.warn("[ycloud-whatsapp] invalid payload", {
        reason: parsedWebhook.reason,
        contentType,
        endpointId: webhookEndpointId || null,
      })

      return NextResponse.json({ ok: false, error: parsedWebhook.reason }, { status: 400 })
    }

    if (parsedWebhook.kind === "unsupported") {
      console.info("[ycloud-whatsapp] skipped event", {
        eventId: parsedWebhook.eventId ?? null,
        eventType: parsedWebhook.eventType ?? null,
        messageType: parsedWebhook.messageType ?? null,
        reason: parsedWebhook.reason,
        endpointId: webhookEndpointId || null,
      })

      return NextResponse.json({ ok: true, skipped: true, reason: parsedWebhook.reason })
    }

    const inbound = parsedWebhook.message

    console.info("[ycloud-whatsapp] inbound message", {
      eventId: inbound.eventId ?? null,
      eventType: inbound.eventType,
      messageId: inbound.messageId ?? null,
      userId: inbound.from,
      from: maskPhone(inbound.from),
      to: maskPhone(inbound.to ?? ""),
      hasBody: inbound.text.length > 0,
      bodyLength: inbound.text.length,
      customerName: inbound.customerName ?? null,
      contentType,
      endpointId: webhookEndpointId || null,
      signaturePresent: Boolean(signature),
      signatureEnforced: shouldEnforceYCloudSignature(),
    })

    const replyText = inbound.text.trim() ? null : EMPTY_MESSAGE_REPLY

    const result =
      replyText ??
      (
        await handleMessage({
          sessionId: inbound.from,
          message: inbound.text,
          phone: inbound.from,
          channel: "whatsapp",
        })
      ).text

    console.info("[ycloud-whatsapp] generated reply", {
      eventId: inbound.eventId ?? null,
      messageId: inbound.messageId ?? null,
      userId: inbound.from,
      replyLength: result.length,
      replyPreview: buildReplyPreview(result),
    })

    try {
      const sendResponse = await sendYCloudWhatsappText({
        to: inbound.from,
        text: result,
      })

      console.info("[ycloud-whatsapp] reply sent", {
        eventId: inbound.eventId ?? null,
        messageId: inbound.messageId ?? null,
        outboundId:
          sendResponse && typeof sendResponse.id === "string"
            ? sendResponse.id
            : sendResponse && typeof sendResponse.wamid === "string"
              ? sendResponse.wamid
              : null,
        userId: inbound.from,
      })

      return NextResponse.json({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error"

      console.error("[ycloud-whatsapp] outbound send failed", {
        eventId: inbound.eventId ?? null,
        messageId: inbound.messageId ?? null,
        userId: inbound.from,
        error: message,
      })

      return NextResponse.json({
        ok: false,
        accepted: true,
        sent: false,
        error: "ycloud_send_failed",
      })
    }
  } catch (error) {
    console.error("[ycloud-whatsapp] unexpected error", error)
    const parsedWebhook = parseYCloudWhatsappWebhook(rawBody)

    try {
      if (parsedWebhook.kind === "text") {
        await sendYCloudWhatsappText({
          to: parsedWebhook.message.from,
          text: ERROR_FALLBACK_REPLY,
        })
      }
    } catch {
      // El fallback también puede fallar por configuración incompleta; ya queda registrado arriba.
    }

    return NextResponse.json(
      {
        ok: false,
        accepted: parsedWebhook.kind === "text",
        error: "processing_failed",
      },
      {
        status: parsedWebhook.kind === "text" ? 200 : 500,
      }
    )
  }
}
