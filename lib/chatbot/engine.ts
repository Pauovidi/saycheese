import "server-only"

import OpenAI from "openai"

import { resolveConversationCommand } from "@/lib/chatbot/commands"
import { formatDateEs, parseSpanishDesiredDate, resolveRequestedPickupDate } from "@/lib/chatbot/dates"
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
  extractCustomerName,
  getAdditionalCakeDecisionIntent,
  extractPhoneFromText,
  hasExplicitNewOrderIntent,
  hasMultipleCakeOrderIntent,
  hasRecentOrderGuard,
  normalizeChatText,
  parseOrderFormat,
} from "@/lib/chatbot/order-intake"
import {
  appendOrderItem,
  buildChatOrderFingerprint,
  isRecentDuplicateFingerprint,
  type ChatOrderItem,
} from "@/lib/chatbot/order-dedupe"
import { cancelChatOrder, createChatOrder } from "@/lib/chatbot/orders"
import {
  ADD_ANOTHER_CAKE_PROMPT,
  buildContextualOrderReplyText,
  buildMissingFieldsPrompt,
  MULTIPLE_CAKES_INTRO,
  NEXT_CAKE_PROMPT,
  ORDER_LOW_CONFIDENCE_RECOVERY,
} from "@/lib/chatbot/order-prompts"
import {
  buildFlavorsAndSizesMessage,
  findFlavorFactsByQuery,
  findExplicitFlavorSelection,
  findProductBySlugOrFlavor,
  listFlavorsAndSizes,
} from "@/lib/chatbot/products"
import { CANCEL_ORDER_TOOL_PARAMETERS, CREATE_ORDER_TOOL_PARAMETERS, HANDOFF_TO_HUMAN_TOOL_PARAMETERS } from "@/lib/chatbot/tool-schemas"
import { hasGreetingIntent, WELCOME_MESSAGE } from "@/lib/chatbot/welcome"
import {
  buildHumanSupportMessage,
  buildUnconfirmedProductInfoMessage,
  CLOSED_PICKUP_DAYS_COPY,
  getCustomerFacingFormatLabel,
  HUMAN_SUPPORT_PHONE_E164,
  HUMAN_SUPPORT_PHONE_DISPLAY,
  HUMAN_SUPPORT_WHATSAPP_LINK,
  PICKUP_ONLY_COPY,
  STORE_HOURS_TEXT,
} from "@/src/data/business"

type HandleMessageInput = {
  sessionId: string
  message: string
  phone?: string
  channel: "web" | "whatsapp"
}

type OrderState = {
  inOrderFlow?: boolean
  flavor?: string
  format?: "tarta" | "cajita"
  pendingItems?: ChatOrderItem[]
  phone?: string
  customerName?: string
  customerEmail?: string
  desiredDate?: string
  suggestedDate?: string
  finalDate?: string
  awaitingConfirm?: boolean
  awaitingName?: boolean
  awaitingAdditionalCakeDecision?: boolean
  expectsMultipleCakes?: boolean
  forceNewOrder?: boolean
  lastCreatedOrderId?: string
  lastCreatedOrderAt?: string
  lastCreatedOrderFingerprint?: string
}

const LEAD_DAYS_RAW = Number.parseInt(process.env.CHATBOT_LEAD_DAYS ?? "3", 10)
const LEAD_DAYS = Number.isFinite(LEAD_DAYS_RAW) && LEAD_DAYS_RAW > 0 ? LEAD_DAYS_RAW : 3
const SHOP_TZ = process.env.SHOP_TZ ?? "Europe/Madrid"
const SUMMARY_THRESHOLD = 30
const ORDER_STATE_PREFIX = "__ORDER_STATE__:"

const SYSTEM_PROMPT = `Eres el asistente de SayCheese.
Responde en español, claro y breve.
No inventes datos de producto. Si faltan ingredientes o alérgenos confirmados, ofrece atención humana.
Política obligatoria: ${PICKUP_ONLY_COPY}
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
  return text
    .replace(/\brecogerte\b/gi, "recogerla")
    .replace(/\brecibir\b/gi, "recoger")
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

function isAffirmative(text: string) {
  const normalized = normalize(text)
  return /\b(si|perfecto|me va bien|de acuerdo|confirmo)\b/.test(normalized)
}

function isNegative(text: string) {
  const normalized = normalize(text)
  return /\b(no|prefiero otro dia|otro dia|otra fecha|no me va bien)\b/.test(normalized)
}

function hasNonEmptyValue(value?: string) {
  return typeof value === "string" && value.trim().length > 0
}

function extractEmailFromText(text: string) {
  const match = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)
  return match?.[0]?.toLowerCase()
}

function hasResetOrderIntent(text: string) {
  const normalized = normalize(text)
  return [/\breiniciar\b/, /\bempezar\s+de\s+nuevo\b/, /\breset\b/].some((pattern) => pattern.test(normalized))
}

function isGenericNonOperationalMessage(text: string) {
  const normalized = normalize(text).replace(/[!?.,;:]/g, " ").replace(/\s+/g, " ").trim()
  if (!normalized) return false

  const exactMessages = new Set([
    "hola",
    "buenos dias",
    "buenas",
    "ok",
    "vale",
    "gracias",
  ])

  return exactMessages.has(normalized)
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

function hasFlavorsIntent(text: string) {
  return /sabor|tamano|tamaño|formato|tarta|grande|cajita|precio/i.test(normalize(text))
}

function hasAllergensIntent(text: string) {
  return /alergen|ingrediente|contiene|lleva/i.test(normalize(text))
}

function hasOrderIntent(text: string) {
  return /quiero|pedido|encargar|tarta|grande|cajita|para\s/i.test(normalize(text))
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

async function buildOrderItemLabel(state: OrderState) {
  if (!state.flavor) return state.format === "cajita" ? "una cajita" : state.format === "tarta" ? "una grande" : "el pedido"

  const flavorFacts = await findFlavorFactsByQuery(state.flavor)
  const product = await findProductBySlugOrFlavor(state.flavor)
  const flavorLabel = flavorFacts?.label ?? product?.name ?? state.flavor.replace(/-/g, " ")
  if (state.format === "cajita") return `una cajita de ${flavorLabel}`
  if (state.format === "tarta") return `una grande de ${flavorLabel}`
  return `el pedido de ${flavorLabel}`
}

function buildCurrentCakeItem(state: OrderState): ChatOrderItem | null {
  if (!state.flavor || !state.format) {
    return null
  }

  return {
    type: state.format === "cajita" ? "box" : "cake",
    flavor: state.flavor,
    qty: 1,
  }
}

function buildPendingOrderItems(state: OrderState) {
  return state.pendingItems ?? []
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

async function buildContextualOrderReply(state: OrderState, channel: "web" | "whatsapp", tz: string) {
  const itemLabel = await buildOrderItemLabel(state)
  const dateLabel = state.finalDate ? formatDateEs(state.finalDate, tz) : null
  const missing = buildMissingFieldsPrompt(state, channel, { preferContinuationTone: Boolean(state.finalDate || state.flavor || state.format) })

  return buildContextualOrderReplyText({
    customerName: state.customerName,
    itemLabel,
    dateLabel,
    missingPrompt: missing,
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

function resetCurrentCakeSelection(state: OrderState) {
  state.flavor = undefined
  state.format = undefined
  state.awaitingName = false
}

function hasMeaningfulOrderProgress(state: OrderState) {
  return Boolean(
    state.finalDate ||
      state.flavor ||
      state.format ||
      state.awaitingConfirm ||
      state.awaitingName ||
      state.awaitingAdditionalCakeDecision ||
      buildPendingOrderItems(state).length
  )
}

function mergeIntroReply(intro: string | null, reply: string) {
  return intro ? `${intro} ${reply}` : reply
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

  if (messagePhone) {
    state.phone = messagePhone
  }

  const email = extractEmailFromText(message)
  if (email) {
    state.customerEmail = email
  }

  const explicitFlavorSelection = await findExplicitFlavorSelection(message)

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

  if (hasFlavorsIntent(message) && !hasOrderIntent(message) && !explicitFlavorSelection) {
    return saveAndReply(userId, await buildFlavorsReply(isOpeningConversation, channel))
  }

  const orderFlow =
    hasOrderIntent(message) ||
    state.inOrderFlow ||
    state.awaitingConfirm ||
    state.awaitingName ||
    state.awaitingAdditionalCakeDecision ||
    Boolean(explicitFlavorSelection)
  if (orderFlow) {
    const explicitNewOrderIntent = hasExplicitNewOrderIntent(message)
    if (explicitNewOrderIntent) {
      state.flavor = undefined
      state.format = undefined
      state.pendingItems = undefined
      state.customerName = undefined
      state.customerEmail = undefined
      state.desiredDate = undefined
      state.suggestedDate = undefined
      state.finalDate = undefined
      state.awaitingConfirm = false
      state.awaitingName = false
      state.awaitingAdditionalCakeDecision = false
      state.expectsMultipleCakes = false
      state.forceNewOrder = true
    } else if (hasRecentOrderGuard(state.lastCreatedOrderAt, now) && !state.inOrderFlow) {
      return saveAndReply(
        userId,
        'Tu último pedido ya quedó creado. Si quieres iniciar otro, escribe "nuevo pedido" y dime sabor, tamaño y fecha.',
        state
      )
    }

    state.inOrderFlow = true
    const multipleCakeIntro =
      hasMultipleCakeOrderIntent(message) && !state.expectsMultipleCakes && !buildPendingOrderItems(state).length
        ? MULTIPLE_CAKES_INTRO
        : null
    if (multipleCakeIntro) {
      state.expectsMultipleCakes = true
    }

    const product = explicitFlavorSelection ?? await detectProductMention(message)
    const format = parseOrderFormat(message)
    const parsedDate = parseSpanishDesiredDate(message, now, SHOP_TZ)
    const genericMessage = isGenericNonOperationalMessage(message)
    const additionalCakeDecisionIntent = state.awaitingAdditionalCakeDecision ? getAdditionalCakeDecisionIntent(message) : "unknown"
    const customerName =
      additionalCakeDecisionIntent === "close"
        ? undefined
        : extractCustomerName(message, {
            blockedNormalizedTerms: product ? [product.name, product.category] : [],
            allowSegmentExtraction: Boolean(product || format || parsedDate || email || messagePhone),
          })
    const hasStructuredContribution = Boolean(product || format || parsedDate || customerName || email || messagePhone)

    if (state.awaitingAdditionalCakeDecision) {
      const wantsCloseOrder =
        additionalCakeDecisionIntent === "close" || (isNegative(message) && !hasStructuredContribution)
      const wantsAddAnotherCake =
        additionalCakeDecisionIntent === "add" || Boolean(product || format || parsedDate)

      if (wantsCloseOrder) {
        state.awaitingAdditionalCakeDecision = false
        return finalizeOrderFromState(userId, state, channel)
      }

      if (wantsAddAnotherCake) {
        state.awaitingAdditionalCakeDecision = false
        state.expectsMultipleCakes = true
        resetCurrentCakeSelection(state)

        if (!product && !format && !parsedDate) {
          return saveAndReply(userId, NEXT_CAKE_PROMPT, state)
        }
      } else if (!hasStructuredContribution) {
        return saveAndReply(userId, ORDER_LOW_CONFIDENCE_RECOVERY, state)
      }
    }

    if (product) {
      state.flavor = product.category
    }

    if (format) {
      state.format = format
    }

    if (state.awaitingConfirm && isAffirmative(message) && state.suggestedDate && !parsedDate && !genericMessage) {
      state.finalDate = state.suggestedDate
      state.awaitingConfirm = false
    }

    if (state.awaitingConfirm && isNegative(message) && !parsedDate) {
      state.awaitingConfirm = false
      state.suggestedDate = undefined
      state.finalDate = undefined
      return saveAndReply(userId, "Perfecto, dime para qué día la necesitas.", state)
    }

    if (parsedDate?.kind === "ambiguous") {
      return saveAndReply(userId, mergeIntroReply(multipleCakeIntro, parsedDate.question), state)
    }

    if (parsedDate?.kind === "date") {
      const resolution = resolveRequestedPickupDate(parsedDate.iso, now, LEAD_DAYS, SHOP_TZ)
      state.desiredDate = parsedDate.iso

      if (resolution.kind === "too_soon") {
        state.suggestedDate = resolution.earliestDate
        state.finalDate = undefined
        state.awaitingConfirm = true

        return saveAndReply(
          userId,
          mergeIntroReply(
            multipleCakeIntro,
            `Aún no llegamos a ${formatDateEs(resolution.requestedDate, SHOP_TZ)} porque trabajamos con un mínimo de ${LEAD_DAYS} días. La primera fecha disponible sería ${formatDateEs(resolution.earliestDate, SHOP_TZ)}. ¿Te va bien?\n${STORE_HOURS_TEXT}`
          ),
          state
        )
      }

      if (resolution.kind === "closed") {
        state.suggestedDate = resolution.nextAvailableDate
        state.finalDate = undefined
        state.awaitingConfirm = true

        return saveAndReply(
          userId,
          mergeIntroReply(
            multipleCakeIntro,
            `No, el ${formatDateEs(resolution.requestedDate, SHOP_TZ)} no hacemos recogidas porque ${CLOSED_PICKUP_DAYS_COPY}. La siguiente fecha disponible sería ${formatDateEs(resolution.nextAvailableDate, SHOP_TZ)}. Si te va bien, te lo apunto para ese día.`
          ),
          state
        )
      }

      if (resolution.kind === "invalid") {
        state.finalDate = undefined

        return saveAndReply(
          userId,
          mergeIntroReply(multipleCakeIntro, "No pude validar esa fecha. Dímela como 30/04, 30 de abril o jueves."),
          state
        )
      }

      state.finalDate = resolution.pickupDate
      state.suggestedDate = undefined
      state.awaitingConfirm = false
    }

    if (customerName) {
      state.customerName = customerName
      state.awaitingName = false
    }

    if (!hasNonEmptyValue(state.customerName)) {
      state.customerName = undefined
    }

    if (!hasStructuredContribution && hasMeaningfulOrderProgress(state)) {
      return saveAndReply(userId, ORDER_LOW_CONFIDENCE_RECOVERY, state)
    }

    if (!state.finalDate) {
      return saveAndReply(
        userId,
        mergeIntroReply(
          multipleCakeIntro,
          "¿Para qué día la necesitas? Puedes decirme una fecha como 16/03, el 18 o un día de la semana."
        ),
        state
      )
    }

    if (!hasNonEmptyValue(state.customerName) && state.flavor && state.format) {
      state.awaitingName = true
      return saveAndReply(userId, mergeIntroReply(multipleCakeIntro, await buildContextualOrderReply(state, channel, SHOP_TZ)), state)
    }

    const missing = buildMissingFieldsPrompt(state, channel, { preferContinuationTone: true })
    if (missing) {
      return saveAndReply(userId, mergeIntroReply(multipleCakeIntro, await buildContextualOrderReply(state, channel, SHOP_TZ)), state)
    }

    if (!hasNonEmptyValue(state.customerName)) {
      state.awaitingName = true
      return saveAndReply(userId, mergeIntroReply(multipleCakeIntro, await buildContextualOrderReply(state, channel, SHOP_TZ)), state)
    }

    const currentCakeItem = buildCurrentCakeItem(state)
    if (currentCakeItem) {
      const completedCakeReply = await buildContextualOrderReply(state, channel, SHOP_TZ)
      state.pendingItems = appendOrderItem(buildPendingOrderItems(state), currentCakeItem)
      resetCurrentCakeSelection(state)
      state.awaitingAdditionalCakeDecision = true

      return saveAndReply(userId, mergeIntroReply(multipleCakeIntro, `${completedCakeReply} ${ADD_ANOTHER_CAKE_PROMPT}`), state)
    }

    if (state.awaitingAdditionalCakeDecision && buildPendingOrderItems(state).length) {
      return saveAndReply(userId, mergeIntroReply(multipleCakeIntro, ADD_ANOTHER_CAKE_PROMPT), state)
    }
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
      description: "Lista sabores y los dos tamaños por sabor",
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
      return {
        flavors: await listFlavorsAndSizes(),
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

