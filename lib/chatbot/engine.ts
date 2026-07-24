import "server-only"

import OpenAI from "openai"

import { resolveConversationCommand } from "@/lib/chatbot/commands"
import { buildHumanSupportPhoneReplyIfIntent } from "@/lib/chatbot/contact"
import { formatDateEs } from "@/lib/chatbot/dates"
import {
  clearConversationState,
  getOrCreateUser,
  getPauseState,
  loadContext,
  pruneMessages,
  saveMessage,
  setLastOpenAIResponseId,
  setPauseState,
  updateSummary,
} from "@/lib/chatbot/memory"
import {
  extractPhoneFromText,
  normalizeChatText,
} from "@/lib/chatbot/order-intake"
import {
  buildChatOrderFingerprint,
  isRecentDuplicateFingerprint,
  type ChatOrderItem,
} from "@/lib/chatbot/order-dedupe"
import {
  buildStoreLocationMessage,
  buildStoreLocationReplyIfIntent,
  hasUnsafeStoreAddressClaim,
} from "@/lib/chatbot/location"
import {
  buildPendingOrderItems,
  processOrderConversationTurn,
  type OrderState,
} from "@/lib/chatbot/order-flow"
import { buildDropsReplyIfIntent } from "@/lib/chatbot/drops"
import { cancelChatOrder, createChatOrder } from "@/lib/chatbot/orders"
import { sendWebOrderWhatsappConfirmation } from "@/lib/chatbot/whatsapp-confirmation"
import {
  buildCatalogForMessage,
  buildFlavorsAndSizesMessage,
  findFlavorFactsByQuery,
  findProductBySlugOrFlavor,
  listFlavorsAndSizes,
} from "@/lib/chatbot/products"
import { CANCEL_ORDER_TOOL_PARAMETERS, CREATE_ORDER_TOOL_PARAMETERS, HANDOFF_TO_HUMAN_TOOL_PARAMETERS } from "@/lib/chatbot/tool-schemas"
import { hasGreetingIntent, WELCOME_MESSAGE } from "@/lib/chatbot/welcome"
import {
  buildHumanSupportMessage,
  buildUnconfirmedProductInfoMessage,
  getCustomerFacingFormatLabel,
  HUMAN_SUPPORT_PHONE_E164,
  HUMAN_SUPPORT_PHONE_DISPLAY,
  HUMAN_SUPPORT_WHATSAPP_LINK,
  PICKUP_ONLY_COPY,
  STORE_ADDRESS,
  STORE_HOURS_TEXT,
} from "@/src/data/business"

type HandleMessageInput = {
  sessionId: string
  message: string
  phone?: string
  channel: "web" | "whatsapp"
}

const LEAD_DAYS_RAW = Number.parseInt(process.env.CHATBOT_LEAD_DAYS ?? "3", 10)
const LEAD_DAYS = Number.isFinite(LEAD_DAYS_RAW) && LEAD_DAYS_RAW > 0 ? LEAD_DAYS_RAW : 3
const SHOP_TZ = process.env.SHOP_TZ ?? "Europe/Madrid"
const SUMMARY_THRESHOLD = 30
const ORDER_STATE_PREFIX = "__ORDER_STATE__:"
const LEGACY_BRAND_PATTERN = new RegExp(["say", "cheese"].join("\\s*"), "gi")

const SYSTEM_PROMPT = `Eres el asistente de Tentados by Néstor Pérez.
Responde en español, claro y breve.
No inventes datos de producto. Si faltan ingredientes o alérgenos confirmados, ofrece atención humana.
No inventes drops, camisetas, tallas ni stock. Las camisetas/drops se responden con la fuente determinista de Drops; WhatsApp no crea pedidos de camisetas.
Política obligatoria: ${PICKUP_ONLY_COPY}
Dirección oficial obligatoria: ${STORE_ADDRESS || "sin dirección configurada"}. Nunca des una dirección distinta.
Teléfono humano oficial: ${HUMAN_SUPPORT_PHONE_DISPLAY}. Nunca presentes el teléfono del cliente como teléfono del negocio.
Nunca uses "recogerte" ni "recibir" para pedidos; usa "recoger"/"recogida".
Plazo mínimo obligatorio: ${LEAD_DAYS} días naturales.
Nunca confirmes ni crees un pedido si falta el nombre del cliente.
Si puedes responder sin tools, responde directo y no llames tools.
Si el usuario pide humano o hay incertidumbre crítica, usa tool handoff_to_human.`

const HANDOFF_KEYWORDS = ["humano", "persona", "agente", "asesor", "operador"]
const WHATSAPP_RESET_REPLY = "He reiniciado la conversación. Te ayudo con un nuevo pedido."

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada")
  }
  return new OpenAI({ apiKey })
}

function normalize(text: string) {
  return normalizeChatText(text)
}

function shouldRequestHandoff(message: string) {
  const normalized = normalize(message)
  return HANDOFF_KEYWORDS.some((word) => normalized.includes(word))
}

function getHandoffText(channel: "web" | "whatsapp") {
  return buildHumanSupportMessage("Te atiende una persona del equipo aquí:", channel)
}

function sanitizeAssistantText(text: string) {
  const sanitized = text
    .replace(LEGACY_BRAND_PATTERN, "Tentados")
    .replace(/\bAuditor[ií]a Temporal\s+[\p{L}-]+\b/giu, "ese sabor")
    .replace(/\brecogerte\b/gi, "recogerla")
    .replace(/\brecibir\b/gi, "recoger")

  return hasUnsafeStoreAddressClaim(sanitized) ? buildStoreLocationMessage() : sanitized
}

function extractOrderState(messages: { role: string; content: string }[]): OrderState {
  const stateMessage = [...messages]
    .reverse()
    .find((message) => message.role === "system" && message.content.startsWith(ORDER_STATE_PREFIX))

  if (!stateMessage) return {}

  try {
    const parsed = JSON.parse(stateMessage.content.slice(ORDER_STATE_PREFIX.length)) as OrderState
    return parsed ?? {}
  } catch {
    return {}
  }
}

async function persistOrderState(userId: string, state: OrderState) {
  await saveMessage(userId, "system", `${ORDER_STATE_PREFIX}${JSON.stringify(state)}`)
}

function hasResetOrderIntent(text: string) {
  const normalized = normalize(text)
  return [/\breiniciar\b/, /\bempezar\s+de\s+nuevo\b/, /\breset\b/].some((pattern) => pattern.test(normalized))
}

async function detectProductMention(text: string) {
  const normalized = normalize(text)

  const direct = await findProductBySlugOrFlavor(text)
  if (direct) return direct

  for (const flavor of await listFlavorsAndSizes()) {
    const normalizedFlavor = normalize(flavor.flavor)
    if (normalized.includes(normalizedFlavor)) {
      return findProductBySlugOrFlavor(flavor.flavor)
    }

    const tokens = normalizedFlavor.split(/\s+/).filter((token) => token.length >= 4)
    if (tokens.some((token) => normalized.includes(token))) {
      return findProductBySlugOrFlavor(flavor.flavor)
    }
  }

  return undefined
}

function hasScheduleIntent(text: string) {
  return /horario|abris|abierto|cerrais/i.test(normalize(text))
}

function hasAllergensIntent(text: string) {
  return /alergen|ingrediente|contiene|lleva/i.test(normalize(text))
}

function hasExistingOrderQueryIntent(text: string) {
  const normalized = normalize(text)
  const patterns = [
    /\bque\s+pasa\s+con\s+mi\s+(pedido|tarta)\b/,
    /\bmi\s+(pedido|tarta)\b/,
    /\bdime\s+mi\s+(pedido|tarta)\b/,
    /\bquiero\s+saber\s+mi\s+(pedido|tarta)\b/,
    /\bpara\s+cuando\s+lo\s+tengo\b/,
    /\besta\s+confirmad[oa]\b/,
    /\best[aá]\s+confirmad[oa]\b/,
    /\ben\s+que\s+estado\s+esta\b/,
    /\bcomo\s+va\s+mi\s+(pedido|tarta)\b/,
  ]

  return patterns.some((pattern) => pattern.test(normalized))
}

async function buildFlavorsReply(includeGreeting: boolean, channel: "web" | "whatsapp") {
  return buildFlavorsAndSizesMessage(includeGreeting, { channel, leadDays: LEAD_DAYS })
}

function requestedProductFacts(message: string) {
  const normalized = normalize(message)
  const asksIngredients = /\bingrediente/.test(normalized)
  const asksAllergens = /\balergen/.test(normalized)
  const asksGenericComposition = /\b(contiene|lleva)\b/.test(normalized)

  return {
    wantsIngredients: asksIngredients || asksGenericComposition,
    wantsAllergens: asksAllergens || asksGenericComposition || (!asksIngredients && !asksAllergens),
  }
}

async function buildProductFactsReply(message: string, channel: "web" | "whatsapp") {
  const product = await detectProductMention(message)
  if (!product) {
    return "Dime qué sabor quieres revisar y te paso la información confirmada."
  }

  const facts = await findFlavorFactsByQuery(product.category)
  if (!facts) {
    return buildUnconfirmedProductInfoMessage(channel)
  }

  const { wantsAllergens, wantsIngredients } = requestedProductFacts(message)
  const sections: string[] = []
  const missingSections: string[] = []

  if (wantsIngredients) {
    if (facts.ingredients.length) {
      sections.push(`Ingredientes confirmados: ${facts.ingredients.join(", ")}.`)
    } else {
      missingSections.push("ingredientes")
    }
  }

  if (wantsAllergens) {
    if (facts.allergens.length) {
      sections.push(`Alérgenos confirmados: ${facts.allergens.join(", ")}.`)
    } else {
      missingSections.push("alérgenos")
    }
  }

  if (!sections.length) {
    return buildUnconfirmedProductInfoMessage(channel)
  }

  if (!missingSections.length) {
    return `Para ${facts.label}: ${sections.join(" ")}`
  }

  return `Para ${facts.label}: ${sections.join(" ")} No tengo confirmado ${missingSections.join(" ni ")} ahora mismo. ${buildHumanSupportMessage("Te atiende un humano aquí:", channel)}`
}

function buildCurrentOrderFingerprint(state: OrderState) {
  const items = buildPendingOrderItems(state)
  if (!state.phone || !state.finalDate || !items.length) {
    return null
  }

  return buildChatOrderFingerprint({
    phone: state.phone,
    deliveryDate: state.finalDate,
    items,
  })
}

function resetOrderState(state: OrderState, channel: "web" | "whatsapp"): OrderState {
  return {
    flavor: undefined,
    format: undefined,
    pendingItems: undefined,
    phone: channel === "whatsapp" ? state.phone : undefined,
    customerName: undefined,
    customerEmail: undefined,
    desiredDate: undefined,
    suggestedDate: undefined,
    pendingSuggestedDateISO: undefined,
    pendingSuggestedDateLabel: undefined,
    pendingSuggestedDateReason: undefined,
    pendingRequestedDate: undefined,
    finalDate: undefined,
    inOrderFlow: false,
    awaitingConfirm: false,
    awaitingName: false,
    awaitingAdditionalCakeDecision: false,
    expectsMultipleCakes: false,
    forceNewOrder: false,
    lastCreatedOrderId: state.lastCreatedOrderId,
    lastCreatedOrderAt: state.lastCreatedOrderAt,
    lastCreatedOrderFingerprint: state.lastCreatedOrderFingerprint,
  }
}

function getCancelOrderHandoffText(channel: "web" | "whatsapp") {
  return buildHumanSupportMessage("Para cancelar un pedido, te atiende una persona del equipo aquí:", channel)
}

async function activateHandoff(userId: string, channel: "web" | "whatsapp", reason?: string) {
  const until = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  await setPauseState(userId, until)
  return {
    handedOff: true,
    reason: reason ?? "Usuario pide asistencia humana",
    contact: {
      phone: HUMAN_SUPPORT_PHONE_E164,
      displayPhone: HUMAN_SUPPORT_PHONE_DISPLAY,
      whatsappLink: channel === "web" ? HUMAN_SUPPORT_WHATSAPP_LINK : undefined,
    },
    message: getHandoffText(channel),
  }
}

async function maybeSummarizeConversation(openai: OpenAI, userId: string, messagesLastN: { role: string; content: string }[]) {
  if (messagesLastN.length < SUMMARY_THRESHOLD) {
    return
  }

  const summaryResponse = await openai.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    max_output_tokens: 200,
    input: [
      {
        role: "system",
        content: "Resume esta conversación para memoria persistente. Máximo 8 líneas, datos operativos y preferencias.",
      },
      {
        role: "user",
        content: messagesLastN.map((message) => `${message.role}: ${message.content}`).join("\n"),
      },
    ],
  })

  const summary = summaryResponse.output_text?.trim()
  if (summary) {
    await updateSummary(userId, summary)
    await pruneMessages(userId, 20)
  }
}

async function saveAndReply(userId: string, text: string, state?: OrderState) {
  const safeText = sanitizeAssistantText(text)
  if (state) {
    await persistOrderState(userId, state)
  }
  await saveMessage(userId, "assistant", safeText)
  return { text: safeText }
}

function logChatOrderCreated(input: {
  path: "finalizeOrderFromState" | "toolRunner.create_order"
  channel: "web" | "whatsapp"
  orderId: string
  phone?: string | null
  reusedExisting?: boolean
  items: ChatOrderItem[]
}) {
  console.info("chat_order_created", {
    path: input.path,
    channel: input.channel,
    orderId: input.orderId,
    hasPhone: Boolean(input.phone?.trim()),
    reusedExisting: Boolean(input.reusedExisting),
    itemCount: input.items.length,
  })
}

async function finalizeOrderFromState(userId: string, state: OrderState, channel: "web" | "whatsapp") {
  const orderItems = buildPendingOrderItems(state)
  const orderFingerprint = buildCurrentOrderFingerprint(state)

  if (
    orderFingerprint &&
    !state.forceNewOrder &&
    isRecentDuplicateFingerprint({
      fingerprint: orderFingerprint,
      previousFingerprint: state.lastCreatedOrderFingerprint,
      previousCreatedAt: state.lastCreatedOrderAt,
    })
  ) {
    return saveAndReply(
      userId,
      `Ese pedido ya estaba creado ✅ Recogida el ${formatDateEs(state.finalDate ?? "", SHOP_TZ)}. ${PICKUP_ONLY_COPY}`,
      resetOrderState(state, channel)
    )
  }

  const confirmedCustomerName = state.customerName ?? ""
  const created = await createChatOrder({
    customer_name: confirmedCustomerName.trim(),
    customer_email: state.customerEmail,
    phone: state.phone,
    delivery_date: state.finalDate,
    items: orderItems,
    notes: `Canal ${channel}. Fecha solicitada=${state.desiredDate ?? state.finalDate}`,
    forceNewOrder: state.forceNewOrder,
  })

  if (!created.ok) {
    return saveAndReply(userId, created.error ?? "No pude crear el pedido ahora mismo.", state)
  }

  logChatOrderCreated({
    path: "finalizeOrderFromState",
    channel,
    orderId: created.orderId,
    phone: state.phone,
    reusedExisting: created.reusedExisting,
    items: orderItems,
  })

  await sendWebOrderWhatsappConfirmation({
    orderId: created.orderId,
    channel,
    phone: state.phone,
    deliveryDate: created.deliveryDate,
    items: orderItems,
    reusedExisting: created.reusedExisting,
  })

  const nextState = resetOrderState(state, channel)
  nextState.lastCreatedOrderId = created.orderId
  nextState.lastCreatedOrderAt = new Date().toISOString()
  nextState.lastCreatedOrderFingerprint = orderFingerprint ?? undefined

  return saveAndReply(
    userId,
    `${created.reusedExisting ? "Ese pedido ya estaba creado ✅" : "Pedido creado ✅"} Recogida el ${formatDateEs(created.deliveryDate, SHOP_TZ)}. ${PICKUP_ONLY_COPY}`,
    nextState
  )
}

export async function handleMessage({ sessionId, message, phone, channel }: HandleMessageInput) {
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini"
  const messagePhone = phone ?? extractPhoneFromText(message)
  const conversationCommand = resolveConversationCommand(channel, message)

  const { userId } = await getOrCreateUser({ channel, externalId: sessionId, phone: messagePhone })
  const handoffText = getHandoffText(channel)

  if (conversationCommand === "whatsapp_reset") {
    await clearConversationState(userId)
    await saveMessage(userId, "user", message)
    await saveMessage(userId, "assistant", WHATSAPP_RESET_REPLY)
    return { text: WHATSAPP_RESET_REPLY }
  }

  const locationReply = buildStoreLocationReplyIfIntent(message)
  if (locationReply) {
    await saveMessage(userId, "user", message)
    await saveMessage(userId, "assistant", locationReply)
    return { text: locationReply }
  }

  const contactPhoneReply = buildHumanSupportPhoneReplyIfIntent(message)
  if (contactPhoneReply) {
    await saveMessage(userId, "user", message)
    await saveMessage(userId, "assistant", contactPhoneReply)
    return { text: contactPhoneReply }
  }

  const pauseState = await getPauseState(userId)
  if (pauseState.botPausedUntil && pauseState.botPausedUntil > new Date()) {
    await saveMessage(userId, "user", message)
    await saveMessage(userId, "assistant", handoffText)
    return { text: handoffText }
  }

  await saveMessage(userId, "user", message)

  if (conversationCommand === "cancel_order_handoff") {
    await activateHandoff(userId, channel, "Solicitud de cancelación de pedido")
    const cancelOrderHandoffText = getCancelOrderHandoffText(channel)
    await saveMessage(userId, "assistant", cancelOrderHandoffText)
    return { text: cancelOrderHandoffText }
  }

  if (shouldRequestHandoff(message)) {
    const handoff = await activateHandoff(userId, channel, "Solicitud explícita")
    await saveMessage(userId, "assistant", handoff.message)
    return { text: handoff.message }
  }

  const context = await loadContext(userId)
  const state = extractOrderState(context.messagesLastN)
  const now = new Date()
  const nonSystemMessages = context.messagesLastN.filter((item) => item.role !== "system")
  const isOpeningConversation = nonSystemMessages.length <= 1

  if (hasGreetingIntent(message) && !state.inOrderFlow && !state.awaitingConfirm && !state.awaitingName) {
    return saveAndReply(userId, WELCOME_MESSAGE)
  }

  if (hasResetOrderIntent(message)) {
    return saveAndReply(
      userId,
      "He reiniciado el pedido actual. Cuando quieras, dime sabor y fecha y empezamos de nuevo.",
      resetOrderState(state, channel)
    )
  }

  if (hasExistingOrderQueryIntent(message)) {
    await activateHandoff(userId, channel, "Consulta de pedido existente")
    return saveAndReply(
      userId,
      "Para revisar tu pedido con seguridad, te atiende una persona del equipo. Si quieres, indícame tu nombre y el día de recogida.",
      resetOrderState(state, channel)
    )
  }

  if (hasScheduleIntent(message)) {
    return saveAndReply(userId, STORE_HOURS_TEXT)
  }

  if (hasAllergensIntent(message)) {
    return saveAndReply(userId, await buildProductFactsReply(message, channel))
  }

  const dropsReply = await buildDropsReplyIfIntent(message)
  if (dropsReply) {
    return saveAndReply(userId, dropsReply, resetOrderState(state, channel))
  }

  const orderTurn = await processOrderConversationTurn({
    message,
    channel,
    state,
    now,
    isOpeningConversation,
    leadDays: LEAD_DAYS,
    shopTz: SHOP_TZ,
    phone: messagePhone,
    deps: { buildFlavorsReply },
  })

  if (orderTurn.kind === "reply") {
    return saveAndReply(userId, orderTurn.text, orderTurn.state)
  }

  if (orderTurn.kind === "finalize") {
    return finalizeOrderFromState(userId, orderTurn.state, channel)
  }

  const openai = getOpenAIClient()
  let safetyEscalate = false

  const tools: OpenAI.Responses.Tool[] = [
    {
      type: "function",
      name: "get_store_hours",
      description: "Devuelve horario de tienda",
      strict: true,
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      type: "function",
      name: "get_flavors_and_sizes",
      description: "Lista sabores disponibles y tamaños/precios en bloque separado",
      strict: true,
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      type: "function",
      name: "get_product_info",
      description: "Da ingredientes y alérgenos confirmados por sabor o slug",
      strict: true,
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "create_order",
      description: "Crea pedido",
      strict: true,
      parameters: CREATE_ORDER_TOOL_PARAMETERS,
    },
    {
      type: "function",
      name: "cancel_order",
      description: "Cancela pedido por teléfono",
      strict: true,
      parameters: CANCEL_ORDER_TOOL_PARAMETERS,
    },
    {
      type: "function",
      name: "handoff_to_human",
      description: "Deriva conversación a humano y pausa bot",
      strict: true,
      parameters: HANDOFF_TO_HUMAN_TOOL_PARAMETERS,
    },
  ]

  const toolRunner = async (name: string, rawArgs: string, fallbackPhone?: string) => {
    const args = (rawArgs ? JSON.parse(rawArgs) : {}) as Record<string, unknown>

    if (name === "get_store_hours") return { hours: STORE_HOURS_TEXT }
    if (name === "get_flavors_and_sizes") {
      const flavorsAndSizes = await listFlavorsAndSizes()
      const catalog = buildCatalogForMessage(flavorsAndSizes)
      return {
        flavors: catalog.flavors,
        sizes: catalog.sizes,
        message: await buildFlavorsReply(false, channel),
      }
    }
    if (name === "handoff_to_human") return activateHandoff(userId, channel, String(args.reason ?? "handoff"))

    if (name === "get_product_info") {
      const product = await findProductBySlugOrFlavor(String(args.query ?? ""))
      if (!product) {
        safetyEscalate = true
        return { found: false, message: "No encontré ese producto." }
      }

      const facts = await findFlavorFactsByQuery(product.category)
      if (!facts?.allergens.length && !facts?.ingredients.length) {
        safetyEscalate = true
      }

      return {
        found: true,
        product: {
          name: facts?.label ?? product.name,
          format: getCustomerFacingFormatLabel(product.format),
          description: facts?.sourceProduct.fullDescription ?? facts?.sourceProduct.shortDescription ?? product.fullDescription ?? product.shortDescription,
          allergens: facts?.allergens ?? [],
          ingredients: facts?.ingredients ?? [],
          fallback: facts?.allergens.length || facts?.ingredients.length ? undefined : buildUnconfirmedProductInfoMessage(channel),
        },
      }
    }

    if (name === "create_order") {
      const created = await createChatOrder({ ...args, phone: String(args.phone ?? fallbackPhone ?? "") })
      if (!created.ok && created.shouldHandoff) {
        safetyEscalate = true
      }
      if (created.ok) {
        const toolItems = Array.isArray(args.items) ? (args.items as ChatOrderItem[]) : []
        const toolPhone = String(args.phone ?? fallbackPhone ?? "")
        logChatOrderCreated({
          path: "toolRunner.create_order",
          channel,
          orderId: created.orderId,
          phone: toolPhone,
          reusedExisting: created.reusedExisting,
          items: toolItems,
        })
        await sendWebOrderWhatsappConfirmation({
          orderId: created.orderId,
          channel,
          phone: toolPhone,
          deliveryDate: created.deliveryDate,
          items: toolItems,
          reusedExisting: created.reusedExisting,
        })
      }
      return created
    }

    if (name === "cancel_order") {
      const cancelled = await cancelChatOrder(String(args.phone ?? fallbackPhone ?? ""), String(args.order_hint ?? ""))
      if (!cancelled.ok && cancelled.shouldHandoff) {
        safetyEscalate = true
      }
      return cancelled
    }

    return { ok: false, error: `Tool no soportada: ${name}` }
  }

  const openAIInput: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(context.summary ? [{ role: "system", content: `Resumen persistente: ${context.summary}` }] : []),
    ...context.messagesLastN
      .filter((item) => item.role !== "system" || !item.content.startsWith(ORDER_STATE_PREFIX))
      .map((item) => ({ role: item.role, content: item.content })),
    { role: "user", content: `Canal=${channel}. ${phone ? `Teléfono=${phone}.` : ""} Mensaje=${message}` },
  ]

  let response = await openai.responses.create({
    model,
    input: openAIInput,
    tools,
    max_output_tokens: 200,
  })

  for (let i = 0; i < 4; i += 1) {
    const calls = response.output.filter((entry) => entry.type === "function_call")
    if (!calls.length) break

    const outputs: any[] = []
    for (const call of calls) {
      if (call.type !== "function_call") continue
      const result = await toolRunner(call.name, call.arguments ?? "{}", phone)
      outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) })
    }

    response = await openai.responses.create({
      model,
      previous_response_id: response.id,
      input: outputs,
      tools,
      max_output_tokens: 200,
    })
  }

  await setLastOpenAIResponseId(userId, response.id)

  let text = sanitizeAssistantText(response.output_text?.trim() || "No pude responder ahora mismo.")

  if (safetyEscalate) {
    const handoff = await activateHandoff(userId, channel, "Incertidumbre crítica")
    text = `${text}\n\n${handoff.message}`
  }

  await saveMessage(userId, "assistant", text)
  await maybeSummarizeConversation(openai, userId, [...context.messagesLastN, { role: "user", content: message }, { role: "assistant", content: text }])

  return { text }
}

