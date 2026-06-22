import type { ChatOrderItem } from "@/lib/chatbot/order-dedupe"
import {
  getTwilioWhatsAppConfig,
  normalizeSpanishWhatsappDestination,
  sendTwilioWhatsAppTemplate,
  type TwilioWhatsAppEnv,
  type TwilioWhatsAppMessageResult,
} from "@/lib/twilio/client"
import {
  getMetaWhatsAppConfig,
  normalizeSpanishMetaWhatsappRecipient,
  sendMetaWhatsAppText,
  type MetaWhatsAppEnv,
  type MetaWhatsAppMessageResult,
} from "@/lib/whatsapp/cloud-api"
import { getAdminClient } from "@/lib/supabase/admin"

type Channel = "web" | "whatsapp"

type ConfirmationReservation =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "disabled"; error?: unknown }

type ConfirmationLogger = Pick<typeof console, "info" | "error">

type ActiveConfirmationProvider = "meta" | "twilio"
type ConfirmationProvider = ActiveConfirmationProvider | "disabled"

type ConfirmationTemplateData = {
  orderSummary: string
  pickupSummary: string
}

type WebOrderConfirmationItem =
  | ChatOrderItem
  | {
      type: "drop"
      flavor?: string
      qty: number
      selected_size?: string
      selected_color?: string
    }

type ConfirmationSendInput =
  | {
      to: string
      body: string
      provider: "meta"
      template: ConfirmationTemplateData
    }
  | {
      to: string
      provider: "twilio"
      template: ConfirmationTemplateData & {
        contentSid: string
        contentVariables: Record<"1" | "2", string>
      }
    }

export type WebOrderWhatsappConfirmationInput = {
  orderId: string
  channel: Channel
  phone?: string | null
  deliveryDate?: string | null
  items: WebOrderConfirmationItem[]
  reusedExisting?: boolean
}

export type SendWebOrderWhatsappConfirmationDeps = {
  env?: TwilioWhatsAppEnv & MetaWhatsAppEnv
  logger?: ConfirmationLogger
  reserve?: (input: { orderId: string; to: string; body: string; provider: ConfirmationProvider }) => Promise<ConfirmationReservation>
  markSent?: (input: { orderId: string; sid?: string; provider: ActiveConfirmationProvider }) => Promise<void>
  markFailed?: (input: { orderId: string; error: unknown }) => Promise<void>
  send?: (input: ConfirmationSendInput) => Promise<TwilioWhatsAppMessageResult | MetaWhatsAppMessageResult>
}

const LEAD_DAYS_RAW = Number.parseInt(process.env.CHATBOT_LEAD_DAYS ?? "3", 10)
const LEAD_DAYS = Number.isFinite(LEAD_DAYS_RAW) && LEAD_DAYS_RAW > 0 ? LEAD_DAYS_RAW : 3

function getItemSizeLabel(type: WebOrderConfirmationItem["type"]) {
  if (type === "drop") return "drop"
  return type === "box" ? "cajita" : "tarta grande"
}

function buildItemsText(items: WebOrderConfirmationItem[]) {
  if (!items.length) return "Pedido confirmado"

  return items
    .map((item) => {
      const qty = item.qty > 1 ? ` x${item.qty}` : ""
      if (item.type === "drop") {
        const options = [item.selected_size, item.selected_color].filter(Boolean).join(" · ")
        return `${getItemSizeLabel(item.type)} ${item.flavor ?? "merch"}${options ? ` (${options})` : ""}${qty}`
      }

      return `${getItemSizeLabel(item.type)} de ${item.flavor}${qty}`
    })
    .join(", ")
}

function buildPickupSummary(deliveryDate?: string | null) {
  return deliveryDate ? `Recogida en tienda el ${formatIsoDateEs(deliveryDate)}` : `Recogida en tienda. Plazo mínimo: ${LEAD_DAYS} días`
}

function formatIsoDateEs(value: string) {
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return value

  return `${day}/${month}/${year}`
}

export function buildWebOrderWhatsappConfirmationMessage(input: {
  deliveryDate?: string | null
  items: WebOrderConfirmationItem[]
}) {
  const pickupText = `${buildPickupSummary(input.deliveryDate)}.`

  return `¡Pedido confirmado! ${buildItemsText(input.items)}. ${pickupText}`
}

function isMissingPersistenceError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /relation .*whatsapp_confirmation_sends.* does not exist|schema cache|PGRST|42P01/i.test(message)
}

function buildDisabledError(provider: ConfirmationProvider, missing: string[]) {
  const providerText = provider === "disabled" ? "WhatsApp confirmation disabled" : `WhatsApp confirmation disabled for ${provider}`
  return new Error(`${providerText}: missing ${missing.join(", ")}`)
}

function buildTwilioTemplateMissingError(missing: string[], hasMetaTemplateName: boolean) {
  const hint = hasMetaTemplateName
    ? "WHATSAPP_TEMPLATE_ORDER_CONFIRMATION_NAME is the Meta template name; Twilio requires TWILIO_ORDER_CONFIRMATION_CONTENT_SID (HX...) from Content Template Builder."
    : "Twilio WhatsApp templates require TWILIO_ORDER_CONFIRMATION_CONTENT_SID (HX...) from Content Template Builder."

  return new Error(`WhatsApp confirmation disabled for twilio: missing ${missing.join(", ")}. ${hint}`)
}

function getConfirmationProvider(input: {
  metaConfig: ReturnType<typeof getMetaWhatsAppConfig>
  twilioConfig: ReturnType<typeof getTwilioWhatsAppConfig>
}): ConfirmationProvider {
  if (input.twilioConfig.missing.length === 0) return "twilio"
  if (input.metaConfig.templateName || input.metaConfig.token || input.metaConfig.phoneNumberId) return "meta"
  return "disabled"
}

function normalizeTemplateVariable(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function buildTwilioContentVariables(input: ConfirmationTemplateData): Record<"1" | "2", string> {
  return {
    "1": normalizeTemplateVariable(input.orderSummary),
    "2": normalizeTemplateVariable(input.pickupSummary),
  }
}

async function reserveOrderWhatsappConfirmation(input: {
  orderId: string
  to: string
  body: string
  provider: ConfirmationProvider
}): Promise<ConfirmationReservation> {
  try {
    const supabase = getAdminClient()
    const { error } = await supabase.from("whatsapp_confirmation_sends").insert({
      order_id: input.orderId,
      channel: "web",
      to_number: input.to,
      body: input.body,
      status: "pending",
    })

    if (!error) return { ok: true }
    if (error.code === "23505") return { ok: false, reason: "duplicate", error }
    if (isMissingPersistenceError(error)) return { ok: false, reason: "disabled", error }

    return { ok: false, reason: "disabled", error }
  } catch (error) {
    if (isMissingPersistenceError(error)) return { ok: false, reason: "disabled", error }
    return { ok: false, reason: "disabled", error }
  }
}

async function markOrderWhatsappConfirmationSent(input: { orderId: string; sid?: string; provider: ActiveConfirmationProvider }) {
  const supabase = getAdminClient()
  await supabase
    .from("whatsapp_confirmation_sends")
    .update({
      status: "sent",
      twilio_sid: input.sid ?? null,
      sent_at: new Date().toISOString(),
      error: null,
    })
    .eq("order_id", input.orderId)
}

async function markOrderWhatsappConfirmationFailed(input: { orderId: string; error: unknown }) {
  const supabase = getAdminClient()
  await supabase
    .from("whatsapp_confirmation_sends")
    .update({
      status: "failed",
      error: input.error instanceof Error ? input.error.message : String(input.error),
    })
    .eq("order_id", input.orderId)
}

export async function sendWebOrderWhatsappConfirmation(
  input: WebOrderWhatsappConfirmationInput,
  deps: SendWebOrderWhatsappConfirmationDeps = {}
) {
  const logger = deps.logger ?? console
  const metaConfig = getMetaWhatsAppConfig(deps.env)
  const twilioConfig = getTwilioWhatsAppConfig(deps.env)
  const provider = getConfirmationProvider({ metaConfig, twilioConfig })
  logger.info("whatsapp_confirmation_attempt", {
    orderId: input.orderId,
    channel: input.channel,
    hasPhone: Boolean(input.phone?.trim()),
    provider,
    hasTwilioSid: Boolean(twilioConfig.accountSid),
    hasTwilioToken: Boolean(twilioConfig.authToken),
    hasTwilioFrom: Boolean(twilioConfig.from),
    hasTwilioContentSid: Boolean(twilioConfig.orderConfirmationContentSid),
    hasMetaToken: Boolean(metaConfig.token),
    hasPhoneNumberId: Boolean(metaConfig.phoneNumberId),
    hasOrderConfirmationTemplate: Boolean(metaConfig.templateName),
  })

  if (input.channel !== "web") {
    logger.info("whatsapp_confirmation_skipped_channel", { orderId: input.orderId, channel: input.channel })
    return { ok: true as const, skipped: "channel" as const }
  }

  if (input.reusedExisting) {
    logger.info("whatsapp_confirmation_duplicate_skipped", { orderId: input.orderId })
    return { ok: true as const, skipped: "duplicate" as const }
  }

  const missing = provider === "meta" ? metaConfig.missing : provider === "twilio" ? twilioConfig.missing : twilioConfig.missing
  const to =
    provider === "meta" ? normalizeSpanishMetaWhatsappRecipient(input.phone) : normalizeSpanishWhatsappDestination(input.phone)

  if (!to) {
    logger.info("whatsapp_confirmation_skipped_missing_phone", { orderId: input.orderId })
    return { ok: true as const, skipped: "missing_phone" as const }
  }

  const body = buildWebOrderWhatsappConfirmationMessage({
    deliveryDate: input.deliveryDate,
    items: input.items,
  })
  const orderSummary = buildItemsText(input.items)
  const pickupSummary = buildPickupSummary(input.deliveryDate)
  const reserved = await (deps.reserve ?? reserveOrderWhatsappConfirmation)({ orderId: input.orderId, to, body, provider })

  if (!reserved.ok) {
    const event = reserved.reason === "duplicate" ? "whatsapp_confirmation_duplicate_skipped" : "whatsapp_confirmation_skipped_disabled"
    logger.info(event, { orderId: input.orderId, error: reserved.error })
    return { ok: true as const, skipped: reserved.reason }
  }

  if (provider === "disabled" || missing.length) {
    logger.info("whatsapp_confirmation_skipped_disabled", { orderId: input.orderId, provider, missing })
    try {
      await (deps.markFailed ?? markOrderWhatsappConfirmationFailed)({ orderId: input.orderId, error: buildDisabledError(provider, missing) })
    } catch (error) {
      logger.error("whatsapp_confirmation_failed", { orderId: input.orderId, error })
    }
    return { ok: true as const, skipped: "disabled" as const }
  }

  if (provider === "twilio" && twilioConfig.templateMissing.length) {
    logger.info("whatsapp_confirmation_skipped_disabled", {
      orderId: input.orderId,
      provider,
      missing: twilioConfig.templateMissing,
    })
    try {
      await (deps.markFailed ?? markOrderWhatsappConfirmationFailed)({
        orderId: input.orderId,
        error: buildTwilioTemplateMissingError(twilioConfig.templateMissing, Boolean(metaConfig.templateName)),
      })
    } catch (error) {
      logger.error("whatsapp_confirmation_failed", { orderId: input.orderId, error })
    }
    return { ok: true as const, skipped: "disabled" as const }
  }

  if (provider === "meta" && !metaConfig.templateName) {
    logger.info("whatsapp_confirmation_meta_template_missing", {
      orderId: input.orderId,
      note: "Meta requires an approved template to initiate conversations outside the 24h customer service window.",
    })
    logger.info("whatsapp_confirmation_skipped_disabled", {
      orderId: input.orderId,
      provider,
      missing: ["WHATSAPP_TEMPLATE_ORDER_CONFIRMATION_NAME"],
    })
    try {
      await (deps.markFailed ?? markOrderWhatsappConfirmationFailed)({
        orderId: input.orderId,
        error: buildDisabledError(provider, ["WHATSAPP_TEMPLATE_ORDER_CONFIRMATION_NAME"]),
      })
    } catch (error) {
      logger.error("whatsapp_confirmation_failed", { orderId: input.orderId, error })
    }
    return { ok: true as const, skipped: "disabled" as const }
  }

  try {
    const sender =
      deps.send ??
      ((sendInput: ConfirmationSendInput) =>
        sendInput.provider === "meta"
          ? sendMetaWhatsAppText(sendInput)
          : sendTwilioWhatsAppTemplate({
              to: sendInput.to,
              contentSid: sendInput.template.contentSid,
              contentVariables: sendInput.template.contentVariables,
            }))
    const template = { orderSummary, pickupSummary }
    const result =
      provider === "meta"
        ? await sender({
            to,
            body,
            provider,
            template,
          })
        : await sender({
            to,
            provider,
            template: {
              ...template,
              contentSid: twilioConfig.orderConfirmationContentSid!,
              contentVariables: buildTwilioContentVariables(template),
            },
          })
    const sid = "sid" in result ? result.sid : "id" in result ? result.id : undefined
    await (deps.markSent ?? markOrderWhatsappConfirmationSent)({ orderId: input.orderId, sid, provider })
    logger.info("whatsapp_confirmation_sent", { orderId: input.orderId, to, provider, sid })
    return { ok: true as const, sent: true as const, to, body }
  } catch (error) {
    try {
      await (deps.markFailed ?? markOrderWhatsappConfirmationFailed)({ orderId: input.orderId, error })
    } catch (markError) {
      logger.error("whatsapp_confirmation_failed", { orderId: input.orderId, error, markError })
      return { ok: false as const, error }
    }

    logger.error("whatsapp_confirmation_failed", { orderId: input.orderId, error })
    return { ok: false as const, error }
  }
}
