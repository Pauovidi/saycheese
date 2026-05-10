import { normalizePhone } from "@/lib/phone"

export type TwilioWhatsAppMessageInput = {
  to: string
  body: string
}

export type TwilioWhatsAppTemplateInput = {
  to: string
  contentSid: string
  contentVariables: Record<string, string>
}

export type TwilioWhatsAppMessageResult = {
  sid?: string
}

export type TwilioWhatsAppConfig = {
  accountSid?: string
  authToken?: string
  from?: string
  orderConfirmationContentSid?: string
  missing: string[]
  templateMissing: string[]
}

export type TwilioWhatsAppEnv = Record<string, string | undefined>

export function getTwilioWhatsAppConfig(env: TwilioWhatsAppEnv = process.env): TwilioWhatsAppConfig {
  const accountSid = env.TWILIO_ACCOUNT_SID
  const authToken = env.TWILIO_AUTH_TOKEN
  const from = env.TWILIO_WHATSAPP_FROM
  const orderConfirmationContentSid = env.TWILIO_ORDER_CONFIRMATION_CONTENT_SID
  const required: Array<[string, string | undefined]> = [
    ["TWILIO_ACCOUNT_SID", accountSid],
    ["TWILIO_AUTH_TOKEN", authToken],
    ["TWILIO_WHATSAPP_FROM", from],
  ]
  const missing = required.flatMap(([key, value]) => (value ? [] : [key]))
  const templateMissing = orderConfirmationContentSid ? [] : ["TWILIO_ORDER_CONFIRMATION_CONTENT_SID"]

  return { accountSid, authToken, from, orderConfirmationContentSid, missing, templateMissing }
}

export function normalizeSpanishWhatsappDestination(value?: string | null) {
  const normalizedPhone = normalizePhone(value)
  if (!normalizedPhone || normalizedPhone.length !== 9) {
    return null
  }

  return `whatsapp:+34${normalizedPhone}`
}

function normalizeWhatsappFrom(value: string) {
  const trimmed = value.trim()
  if (/^whatsapp:/i.test(trimmed)) {
    return trimmed
  }

  return `whatsapp:${trimmed}`
}

function getTwilioErrorMessage(responseBody: string, status: number) {
  try {
    const parsed = JSON.parse(responseBody)
    const code = parsed?.code
    const message = parsed?.message
    return `Twilio WhatsApp error ${status}${code ? ` code=${code}` : ""}: ${message ?? responseBody}`
  } catch {
    return responseBody || `Twilio WhatsApp error ${status}`
  }
}

export async function sendTwilioWhatsAppText(input: TwilioWhatsAppMessageInput): Promise<TwilioWhatsAppMessageResult> {
  const config = getTwilioWhatsAppConfig()
  if (config.missing.length || !config.accountSid || !config.authToken || !config.from) {
    throw new Error(`Twilio WhatsApp no configurado: faltan ${config.missing.join(", ")}`)
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: normalizeWhatsappFrom(config.from),
      To: input.to,
      Body: input.body,
    }),
  })

  const responseBody = await response.text()
  if (!response.ok) {
    throw new Error(getTwilioErrorMessage(responseBody, response.status))
  }

  try {
    return { sid: JSON.parse(responseBody).sid }
  } catch {
    return {}
  }
}

export async function sendTwilioWhatsAppTemplate(
  input: TwilioWhatsAppTemplateInput
): Promise<TwilioWhatsAppMessageResult> {
  const config = getTwilioWhatsAppConfig()
  if (config.missing.length || !config.accountSid || !config.authToken || !config.from) {
    throw new Error(`Twilio WhatsApp no configurado: faltan ${config.missing.join(", ")}`)
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: normalizeWhatsappFrom(config.from),
      To: input.to,
      ContentSid: input.contentSid,
      ContentVariables: JSON.stringify(input.contentVariables),
    }),
  })

  const responseBody = await response.text()
  if (!response.ok) {
    throw new Error(getTwilioErrorMessage(responseBody, response.status))
  }

  try {
    return { sid: JSON.parse(responseBody).sid }
  } catch {
    return {}
  }
}
