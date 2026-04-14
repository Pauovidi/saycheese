import "server-only"

import OpenAI from "openai"

import { isWhatsappConversationResetCommand } from "@/lib/chatbot/commands"
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
import { cancelChatOrder, createChatOrder } from "@/lib/chatbot/orders"
import { buildMissingFieldsPrompt } from "@/lib/chatbot/order-prompts"
import {
  findFlavorFactsByQuery,
  findProductBySlugOrFlavor,
  listFlavorsAndSizes,
} from "@/lib/chatbot/products"
import { hasGreetingIntent, WELCOME_MESSAGE } from "@/lib/chatbot/welcome"
import {
  buildHumanSupportMessage,
  buildUnconfirmedProductInfoMessage,
  CLOSED_PICKUP_DAYS_COPY,
  FORMAT_SIZE_COPY,
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
  phone?: string
  customerName?: string
  customerEmail?: string
  desiredDate?: string
  suggestedDate?: string
  finalDate?: string
  awaitingConfirm?: boolean
  awaitingName?: boolean
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
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

function extractPhoneFromText(text: string) {
  const match = text.match(/(?:\+?\d[\d\s-]{6,}\d)/)
  if (!match) return undefined
  return match[0].replace(/\s+/g, "").replace(/-/g, "")
}

function parseFormat(text: string): "tarta" | "cajita" | undefined {
  const normalized = normalize(text)
  if (/\b(cajita|caja|pequena|pequeña|pequeno|pequeño|mini|individual)\b/.test(normalized)) return "cajita"
  if (/\b(tarta|grande|mediana|mediano)\b/.test(normalized)) return "tarta"
  return undefined
}

function isAffirmative(text: string) {
  const normalized = normalize(text)
  return /\b(si|perfecto|me va bien|de acuerdo|confirmo)\b/.test(normalized)
}

function isNegative(text: string) {
  const normalized = normalize(text)
  return /\b(no|prefiero otro dia|otro dia|otra fecha|no me va bien)\b/.test(normalized)
}

function cleanCustomerNameCandidate(value: string) {
  return value.replace(/^[\s,:-]+|[\s,.!?;:]+$/g, "").replace(/\s+/g, " ").trim()
}

function hasNonEmptyValue(value?: string) {
  return typeof value === "string" && value.trim().length > 0
}

function splitNameCandidate(value: string) {
  const withoutPhone = value.replace(/(?:^|\s)\+?\d[\d\s-]{5,}\d.*$/u, "")

  return withoutPhone
    .split(/[,.!?;:]+/)[0]
    ?.split(/\b(?:y\s+)?(?:quiero|queria|quería|necesito|busco|para|seria|sería|quisiera|con|mi\s+correo|correo|email|telefono|teléfono|movil|móvil|numero|número|pero|aunque|porque|que|pues)\b/i)[0]
    ?.trim() ?? ""
}

function isStandaloneNameMessage(text: string, candidate: string) {
  const cleanedText = cleanCustomerNameCandidate(
    text
      .replace(/\+?\d[\d\s-]{5,}\d/g, " ")
      .replace(/\b(?:mi\s+)?(?:telefono|teléfono|movil|móvil|numero|número|es)\b/gi, " ")
      .replace(/[,.!?;:]+/g, " ")
  )
  if (!cleanedText || !candidate) return false

  return normalize(cleanedText) === normalize(candidate)
}

function isLikelyCustomerName(value: string) {
  const trimmed = cleanCustomerNameCandidate(splitNameCandidate(value))
  if (!trimmed) return false
  if (trimmed.length < 2 || trimmed.length > 60) return false
  if (/@/.test(trimmed) || /\d/.test(trimmed)) return false
  const normalizedTrimmed = normalize(trimmed)

  const words = trimmed.split(/\s+/)
  if (words.length > 4) return false
  if (!words.every((word) => /^[\p{L}'-]+$/u.test(word))) return false

  if (findProductBySlugOrFlavor(trimmed)) return false

  const blockedPhrases = new Set([
    "buenos dias",
    "buenas tardes",
    "buenas noches",
    "hola buenos dias",
    "hola buenas",
    "el lunes",
    "el martes",
    "el miercoles",
    "el miércoles",
    "el jueves",
    "el viernes",
    "el sabado",
    "el sábado",
    "el domingo",
  ])
  if (blockedPhrases.has(normalizedTrimmed)) return false

  const blocked = new Set([
    "pues",
    "si",
    "sí",
    "no",
    "nop",
    "nope",
    "bueno",
    "genial",
    "claro",
    "perfecto",
    "entonces",
    "luego",
    "oye",
    "mira",
    "nah",
    "nada",
    "ninguno",
    "ninguna",
    "vale",
    "ok",
    "perfecto",
    "pedido",
    "tarta",
    "cajita",
    "hoy",
    "manana",
    "mañana",
    "lunes",
    "martes",
    "miercoles",
    "miércoles",
    "jueves",
    "viernes",
    "sabado",
    "sábado",
    "domingo",
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "setiembre",
    "octubre",
    "noviembre",
    "diciembre",
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "sept",
    "oct",
    "nov",
    "dic",
    "hola",
    "buenas",
    "gracias",
  ])
  return !words.some((word) => blocked.has(normalize(word)))
}

function extractCustomerName(text: string) {
  const patterns = [
    /(?:me\s+llamo|soy)\s+(.+)/i,
    /mi\s+nombre\s+es\s+(.+)/i,
    /a\s+nombre\s+de\s+(.+)/i,
    /^nombre\s*[:\-]?\s*(.+)$/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    const candidate = cleanCustomerNameCandidate(splitNameCandidate(match?.[1] ?? ""))
    if (isLikelyCustomerName(candidate)) {
      return candidate
    }
  }

  const directCandidate = cleanCustomerNameCandidate(splitNameCandidate(text))
  if (isStandaloneNameMessage(text, directCandidate) && isLikelyCustomerName(directCandidate)) {
    return directCandidate
  }

  return undefined
}

function extractEmailFromText(text: string) {
  const match = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)
  return match?.[0]?.toLowerCase()
}

function hasResetOrderIntent(text: string) {
  const normalized = normalize(text)
  return [
    /\breiniciar\b/,
    /\bempezar\s+de\s+nuevo\b/,
    /\bcancelar\s+pedido\b/,
    /\bcancelar\b/,
    /\breset\b/,
  ].some((pattern) => pattern.test(normalized))
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

function detectProductMention(text: string) {
  const normalized = normalize(text)

  const direct = findProductBySlugOrFlavor(text)
  if (direct) return direct

  for (const flavor of listFlavorsAndSizes()) {
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

function buildFlavorsReply() {
  const flavors = listFlavorsAndSizes()
  const lines = flavors.map((entry) => {
    const sizes = entry.sizes.map((size) => `${size.label}: ${size.priceText}`).join(" | ")
    return `- ${entry.flavor}: ${sizes}`
  })

  return `${FORMAT_SIZE_COPY}\n${lines.join("\n")}\n${PICKUP_ONLY_COPY}`
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

function buildProductFactsReply(message: string, channel: "web" | "whatsapp") {
  const product = detectProductMention(message)
  if (!product) {
    return "Dime qué sabor quieres revisar y te paso la información confirmada."
  }

  const facts = findFlavorFactsByQuery(product.category)
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

function buildOrderItemLabel(state: OrderState) {
  if (!state.flavor) return state.format === "cajita" ? "una pequeña" : state.format === "tarta" ? "una grande" : "el pedido"

  const flavorLabel = findFlavorFactsByQuery(state.flavor)?.label ?? findProductBySlugOrFlavor(state.flavor)?.name ?? state.flavor.replace(/-/g, " ")
  if (state.format === "cajita") return `una ${flavorLabel} pequeña`
  if (state.format === "tarta") return `una ${flavorLabel} grande`
  return `el pedido de ${flavorLabel}`
}

function buildContextualOrderReply(state: OrderState, channel: "web" | "whatsapp", tz: string) {
  const name = hasNonEmptyValue(state.customerName) ? `, ${state.customerName?.trim()}` : ""
  const itemLabel = buildOrderItemLabel(state)
  const dateLabel = state.finalDate ? formatDateEs(state.finalDate, tz) : null
  const prefix = dateLabel
    ? `De acuerdo${name}. Te apunto ${itemLabel} para el ${dateLabel}.`
    : `De acuerdo${name}.`
  const missing = buildMissingFieldsPrompt(state, channel)

  if (!missing) {
    return prefix
  }

  return `${prefix} ${missing}`
}

function resetOrderState(state: OrderState, channel: "web" | "whatsapp"): OrderState {
  return {
    phone: channel === "whatsapp" ? state.phone : undefined,
    inOrderFlow: false,
  }
}

function buildPendingOrderReply(state: OrderState, channel: "web" | "whatsapp", tz: string) {
  if (state.awaitingConfirm && state.suggestedDate) {
    return `Sigo pendiente de la fecha. Si te va bien ${formatDateEs(state.suggestedDate, tz)}, dime "sí". Si no, pásame otra fecha y lo rehacemos.`
  }

  if (state.finalDate || state.flavor || state.format) {
    return buildContextualOrderReply(state, channel, tz)
  }

  return 'Cuando quieras, dime sabor y fecha y seguimos con el pedido. Si prefieres empezar de nuevo, escribe "reiniciar".'
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

export async function handleMessage({ sessionId, message, phone, channel }: HandleMessageInput) {
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini"

  const { userId } = await getOrCreateUser({ channel, externalId: sessionId, phone })
  const handoffText = getHandoffText(channel)

  if (isWhatsappConversationResetCommand(channel, message)) {
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

  if (shouldRequestHandoff(message)) {
    const handoff = await activateHandoff(userId, channel, "Solicitud explícita")
    await saveMessage(userId, "assistant", handoff.message)
    return { text: handoff.message }
  }

  const context = await loadContext(userId)
  const state = extractOrderState(context.messagesLastN)
  const now = new Date()

  const messagePhone = phone ?? extractPhoneFromText(message)
  if (messagePhone) {
    state.phone = messagePhone
  }

  const email = extractEmailFromText(message)
  if (email) {
    state.customerEmail = email
  }

  if (hasGreetingIntent(message)) {
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
    return saveAndReply(userId, buildProductFactsReply(message, channel))
  }

  if (hasFlavorsIntent(message) && !hasOrderIntent(message)) {
    return saveAndReply(userId, buildFlavorsReply())
  }

  const orderFlow = hasOrderIntent(message) || state.inOrderFlow || state.awaitingConfirm || state.awaitingName
  if (orderFlow) {
    state.inOrderFlow = true

    const product = detectProductMention(message)
    if (product) {
      state.flavor = product.category
    }

    const format = parseFormat(message)
    if (format) {
      state.format = format
    }

    const parsedDate = parseSpanishDesiredDate(message, now, SHOP_TZ)
    const genericMessage = isGenericNonOperationalMessage(message)

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

    if (
      genericMessage &&
      !parsedDate &&
      !product &&
      !format &&
      !extractCustomerName(message) &&
      !email
    ) {
      return saveAndReply(userId, buildPendingOrderReply(state, channel, SHOP_TZ), state)
    }

    if (parsedDate?.kind === "ambiguous") {
      return saveAndReply(userId, parsedDate.question, state)
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
          `Aún no llegamos a ${formatDateEs(resolution.requestedDate, SHOP_TZ)} porque trabajamos con un mínimo de ${LEAD_DAYS} días. La primera fecha disponible sería ${formatDateEs(resolution.earliestDate, SHOP_TZ)}. ¿Te va bien?\n${STORE_HOURS_TEXT}`,
          state
        )
      }

      if (resolution.kind === "closed") {
        state.suggestedDate = resolution.nextAvailableDate
        state.finalDate = undefined
        state.awaitingConfirm = true

        return saveAndReply(
          userId,
          `No, el ${formatDateEs(resolution.requestedDate, SHOP_TZ)} no hacemos recogidas porque ${CLOSED_PICKUP_DAYS_COPY}. La siguiente fecha disponible sería ${formatDateEs(resolution.nextAvailableDate, SHOP_TZ)}. Si te va bien, te lo apunto para ese día.`,
          state
        )
      }

      state.finalDate = resolution.pickupDate
      state.suggestedDate = undefined
      state.awaitingConfirm = false
    }

    const customerName = extractCustomerName(message)
    if (customerName) {
      state.customerName = customerName
      state.awaitingName = false
    }

    if (!hasNonEmptyValue(state.customerName)) {
      state.customerName = undefined
    }

    if (!state.finalDate) {
      return saveAndReply(userId, "¿Para qué día la necesitas? Puedes decirme una fecha como 16/03, el 18 o un día de la semana.", state)
    }

    if (!hasNonEmptyValue(state.customerName) && state.flavor && state.format) {
      state.awaitingName = true
      return saveAndReply(userId, buildContextualOrderReply(state, channel, SHOP_TZ), state)
    }

    const missing = buildMissingFieldsPrompt(state, channel)
    if (missing) {
      return saveAndReply(userId, buildContextualOrderReply(state, channel, SHOP_TZ), state)
    }

    if (!hasNonEmptyValue(state.customerName)) {
      state.awaitingName = true
      return saveAndReply(userId, buildContextualOrderReply(state, channel, SHOP_TZ), state)
    }

    const created = await createChatOrder({
      customer_name: state.customerName.trim(),
      customer_email: state.customerEmail,
      phone: state.phone,
      delivery_date: state.finalDate,
      items: [
        {
          type: state.format === "cajita" ? "box" : "cake",
          flavor: state.flavor,
          qty: 1,
        },
      ],
      notes: `Canal ${channel}. Fecha solicitada=${state.desiredDate ?? state.finalDate}`,
    })

    if (!created.ok) {
      return saveAndReply(userId, created.error ?? "No pude crear el pedido ahora mismo.", state)
    }

    const nextState = resetOrderState(state, channel)
    return saveAndReply(
      userId,
      `Pedido creado. Recogida el ${formatDateEs(created.deliveryDate, SHOP_TZ)}. ${PICKUP_ONLY_COPY}`,
      nextState
    )
  }

  const openai = getOpenAIClient()
  let safetyEscalate = false

  const tools: OpenAI.Responses.Tool[] = [
    {
      type: "function",
      name: "get_store_hours",
      description: "Devuelve horario de tienda",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      type: "function",
      name: "get_flavors_and_sizes",
      description: "Lista sabores y los dos tamaños por sabor",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      type: "function",
      name: "get_product_info",
      description: "Da ingredientes y alérgenos confirmados por sabor o slug",
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
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          customer_email: { type: "string" },
          phone: { type: "string" },
          delivery_date: { type: "string" },
          notes: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["cake", "box"] },
                flavor: { type: "string" },
                qty: { type: "number" },
              },
              required: ["type", "flavor", "qty"],
              additionalProperties: false,
            },
          },
        },
        required: ["customer_name", "phone", "items"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "cancel_order",
      description: "Cancela pedido por teléfono",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string" },
          order_hint: { type: "string" },
        },
        required: ["phone"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "handoff_to_human",
      description: "Deriva conversación a humano y pausa bot",
      parameters: {
        type: "object",
        properties: { reason: { type: "string" } },
        additionalProperties: false,
      },
    },
  ]

  const toolRunner = async (name: string, rawArgs: string, fallbackPhone?: string) => {
    const args = (rawArgs ? JSON.parse(rawArgs) : {}) as Record<string, unknown>

    if (name === "get_store_hours") return { hours: STORE_HOURS_TEXT }
    if (name === "get_flavors_and_sizes") return { flavors: listFlavorsAndSizes() }
    if (name === "handoff_to_human") return activateHandoff(userId, channel, String(args.reason ?? "handoff"))

    if (name === "get_product_info") {
      const product = findProductBySlugOrFlavor(String(args.query ?? ""))
      if (!product) {
        safetyEscalate = true
        return { found: false, message: "No encontré ese producto." }
      }

      const facts = findFlavorFactsByQuery(product.category)
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

