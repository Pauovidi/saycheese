import { NextResponse } from "next/server"

import { validateTwilioSignature } from "@/lib/twilio/signature"
import { createTwilioMessagingResponse, createTwilioXmlResponse } from "@/lib/twilio/twiml"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TWILIO_OK_MESSAGE = "Prueba OK SayCheese"

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

function maskPhone(value: string) {
  if (!value) return ""
  if (value.length <= 6) return "***"

  return `${value.slice(0, 4)}***${value.slice(-2)}`
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
      from: maskPhone(from),
      to: maskPhone(to),
      hasBody: body.length > 0,
      bodyLength: body.length,
      contentType,
      signaturePresent: Boolean(twilioSignature),
      signatureEnforced: shouldEnforceTwilioSignature(),
    })

    return createTwilioXmlResponse(createTwilioMessagingResponse(TWILIO_OK_MESSAGE))
  } catch (error) {
    console.error("[twilio-whatsapp] unexpected error", error)

    return createTwilioXmlResponse(createTwilioMessagingResponse(TWILIO_OK_MESSAGE))
  }
}
