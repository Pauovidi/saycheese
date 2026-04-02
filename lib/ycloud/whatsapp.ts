const YCLOUD_API_BASE_URL = "https://api.ycloud.com/v2"
const YCLOUD_INBOUND_EVENT_TYPES = new Set([
  "whatsapp.inbound.message",
  "whatsapp.inbound_message.received",
])

type RecordValue = Record<string, unknown>

type ParsedInboundTextMessage = {
  eventId?: string
  eventType: string
  messageId?: string
  messageType: string
  text: string
  from: string
  to?: string
  customerName?: string
}

type ParsedYCloudWebhookResult =
  | { kind: "text"; message: ParsedInboundTextMessage }
  | { kind: "unsupported"; reason: string; eventId?: string; eventType?: string; messageType?: string }
  | { kind: "invalid"; reason: string }

type SendYCloudWhatsappTextInput = {
  to: string
  text: string
}

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, "").trim()
}

function getYCloudConfig() {
  return {
    apiBaseUrl: process.env.YCLOUD_API_BASE_URL?.trim() || YCLOUD_API_BASE_URL,
    apiKey: process.env.YCLOUD_API_KEY?.trim() || "",
    from: process.env.YCLOUD_PHONE_NUMBER?.trim() || "",
  }
}

function safeParseJson(rawBody: string) {
  try {
    return JSON.parse(rawBody) as unknown
  } catch {
    return null
  }
}

export function maskPhone(value: string) {
  if (!value) return ""
  if (value.length <= 6) return "***"

  return `${value.slice(0, 4)}***${value.slice(-2)}`
}

export function buildReplyPreview(value: string) {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value
}

export function parseYCloudWhatsappWebhook(rawBody: string): ParsedYCloudWebhookResult {
  const payload = safeParseJson(rawBody)

  if (!isRecord(payload)) {
    return { kind: "invalid", reason: "invalid_json" }
  }

  const eventId = getString(payload.id)
  const eventType = getString(payload.type)

  if (!eventType) {
    return { kind: "invalid", reason: "missing_event_type" }
  }

  if (!YCLOUD_INBOUND_EVENT_TYPES.has(eventType)) {
    return {
      kind: "unsupported",
      reason: "event_type_not_supported",
      eventId: eventId || undefined,
      eventType,
    }
  }

  const inboundMessage = payload.whatsappInboundMessage

  if (!isRecord(inboundMessage)) {
    return { kind: "invalid", reason: "missing_whatsapp_inbound_message" }
  }

  const messageType = getString(inboundMessage.type)

  if (messageType !== "text") {
    return {
      kind: "unsupported",
      reason: "message_type_not_supported",
      eventId: eventId || undefined,
      eventType,
      messageType: messageType || undefined,
    }
  }

  const textPayload = inboundMessage.text
  const customerProfile = inboundMessage.customerProfile
  const from = normalizePhone(getString(inboundMessage.from))
  const text = isRecord(textPayload) ? getString(textPayload.body) : ""

  if (!from) {
    return { kind: "invalid", reason: "missing_from" }
  }

  return {
    kind: "text",
    message: {
      eventId: eventId || undefined,
      eventType,
      messageId: getString(inboundMessage.wamid) || getString(inboundMessage.id) || undefined,
      messageType,
      text,
      from,
      to: normalizePhone(getString(inboundMessage.to)) || undefined,
      customerName: isRecord(customerProfile) ? getString(customerProfile.name) || undefined : undefined,
    },
  }
}

export async function sendYCloudWhatsappText(input: SendYCloudWhatsappTextInput) {
  const config = getYCloudConfig()

  if (!config.apiKey || !config.from) {
    throw new Error("Faltan YCloud API key o número de negocio")
  }

  const response = await fetch(`${config.apiBaseUrl}/whatsapp/messages/sendDirectly`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
    },
    body: JSON.stringify({
      from: config.from,
      to: input.to,
      type: "text",
      text: {
        body: input.text,
      },
    }),
  })

  const rawResponse = await response.text()
  const parsedResponse = rawResponse ? safeParseJson(rawResponse) : null

  if (!response.ok) {
    throw new Error(
      `YCloud sendDirectly failed (${response.status}): ${rawResponse || response.statusText || "sin detalle"}`
    )
  }

  return isRecord(parsedResponse) ? parsedResponse : null
}
