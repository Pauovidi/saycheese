import { normalizePhone } from "@/lib/phone"

const GRAPH_API_BASE = "https://graph.facebook.com/v23.0"

export type MetaWhatsAppEnv = Record<string, string | undefined>

export type MetaWhatsAppConfig = {
  token?: string
  phoneNumberId?: string
  templateName?: string
  templateLang: string
  missing: string[]
}

export type MetaWhatsAppMessageInput = {
  to: string
  body: string
  template?: {
    orderSummary: string
    pickupSummary: string
  }
}

export type MetaWhatsAppMessageResult = {
  id?: string
}

export function getMetaWhatsAppConfig(env: MetaWhatsAppEnv = process.env): MetaWhatsAppConfig {
  const token = env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID
  const required: Array<[string, string | undefined]> = [
    ["WHATSAPP_ACCESS_TOKEN", token],
    ["WHATSAPP_PHONE_NUMBER_ID", phoneNumberId],
  ]

  return {
    token,
    phoneNumberId,
    templateName: env.WHATSAPP_TEMPLATE_ORDER_CONFIRMATION_NAME,
    templateLang: env.WHATSAPP_TEMPLATE_LANG ?? "es_ES",
    missing: required.flatMap(([key, value]) => (value ? [] : [key])),
  }
}

export function normalizeSpanishMetaWhatsappRecipient(value?: string | null) {
  const normalizedPhone = normalizePhone(value)
  if (!normalizedPhone || normalizedPhone.length !== 9) {
    return null
  }

  return `34${normalizedPhone}`
}

function getMetaErrorMessage(responseBody: string, status: number) {
  try {
    const parsed = JSON.parse(responseBody)
    const message = parsed?.error?.message
    const code = parsed?.error?.code
    const subcode = parsed?.error?.error_subcode
    return `Meta WhatsApp error ${status}${code ? ` code=${code}` : ""}${subcode ? ` subcode=${subcode}` : ""}: ${
      message ?? responseBody
    }`
  } catch {
    return responseBody || `Meta WhatsApp error ${status}`
  }
}

export async function sendMetaWhatsAppText(input: MetaWhatsAppMessageInput): Promise<MetaWhatsAppMessageResult> {
  const config = getMetaWhatsAppConfig()
  if (config.missing.length || !config.token || !config.phoneNumberId) {
    throw new Error(`Meta WhatsApp no configurado: faltan ${config.missing.join(", ")}`)
  }

  const payload = config.templateName
    ? {
        messaging_product: "whatsapp",
        to: input.to,
        type: "template",
        template: {
          name: config.templateName,
          language: { code: config.templateLang },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: input.template?.orderSummary ?? input.body },
                { type: "text", text: input.template?.pickupSummary ?? "Recogida en tienda" },
              ],
            },
          ],
        },
      }
    : {
        messaging_product: "whatsapp",
        to: input.to,
        text: { body: input.body },
      }

  const response = await fetch(`${GRAPH_API_BASE}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const responseBody = await response.text()
  if (!response.ok) {
    throw new Error(getMetaErrorMessage(responseBody, response.status))
  }

  try {
    return { id: JSON.parse(responseBody).messages?.[0]?.id }
  } catch {
    return {}
  }
}
