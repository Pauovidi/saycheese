import "server-only"

import OpenAI from "openai"

import { earliestPickupDateISO, formatDateEs, parseSpanishDesiredDate } from "@/lib/chatbot/dates"
import {
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
import {
  extractAllergensAndIngredients,
  findProductBySlugOrFlavor,
  listFlavorsAndSizes,
} from "@/lib/chatbot/products"

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
  desiredDate?: string
  suggestedDate?: string
  finalDate?: string
  awaitingConfirm?: boolean
}

const LEAD_DAYS_RAW = Number.parseInt(process.env.CHATBOT_LEAD_DAYS ?? "3", 10)
const LEAD_DAYS = Number.isFinite(LEAD_DAYS_RAW) && LEAD_DAYS_RAW > 0 ? LEAD_DAYS_RAW : 3
const SHOP_TZ = process.env.SHOP_TZ ?? "Europe/Madrid"
const STORE_HOURS_TEXT = "Lunes a sábado de 09:00 a 19:00. Domingos cerrado."
const POLICY_TEXT = "Solo recogida en tienda. No hacemos envíos."
const SUMMARY_THRESHOLD = 30
const ORDER_STATE_PREFIX = "__ORDER_STATE__:"

const SYSTEM_PROMPT = `Eres el asistente de SayCheese.
Responde en español, claro y breve.
No inventes alérgenos/ingredientes. Si no están en la ficha, di exactamente: "no lo veo en la ficha".
Política obligatoria: ${POLICY_TEXT}
Nunca uses "recogerte" ni "recibir" para pedidos; usa "recoger"/"recogida".
Plazo mínimo obligatorio: ${LEAD_DAYS} días naturales.
Si puedes responder sin tools, responde directo y no llames tools.
Si el usuario pide humano o hay incertidumbre crítica, usa tool handoff_to_human.`

const HANDOFF_TEXT =
  `Te paso con una persona del equipo. ` +
  `Puedes contactar en ${process.env.HUMAN_SUPPORT_PHONE_E164 ?? "(configurar HUMAN_SUPPORT_PHONE_E164)"}. ` +
  `${process.env.HUMAN_SUPPORT_WHATSAPP_LINK ? `WhatsApp: ${process.env.HUMAN_SUPPORT_WHATSAPP_LINK}` : ""}`

const HANDOFF_KEYWORDS = ["humano", "persona", "agente", "asesor", "operador"]

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
  if (/\bcajita\b/.test(normalized)) return "cajita"
  if (/\btarta\b/.test(normalized)) return "tarta"
  return undefined
}

function isAffirmative(text: string) {
  const normalized = normalize(text)
  return /\b(si|vale|ok|perfecto|me va bien|de acuerdo|confirmo)\b/.test(normalized)
}

function isNegative(text: string) {
  const normalized = normalize(text)
  return /\b(no|prefiero otro dia|otro dia|otra fecha|no me va bien)\b/.test(normalized)
}

function detectProductMention(text: string) {
  const normalized = normalize(text)

  const direct = findProductBySlugOrFlavor(text)
  if (direct) return direct

  for (const flavor of listFlavorsAndSizes()) {
    if (normalized.includes(normalize(flavor.flavor))) {
      return findProductBySlugOrFlavor(flavor.flavor)
    }
  }

  return undefined
}

function hasScheduleIntent(text: string) {
  return /horario|abris|abierto|cerrais/i.test(normalize(text))
}

function hasFlavorsIntent(text: string) {
  return /sabor|tamano|tamaño|formato|tarta|cajita|precio/i.test(normalize(text))
}

function hasAllergensIntent(text: string) {
  return /alergen|ingrediente|contiene|lleva/i.test(normalize(text))
}

function hasOrderIntent(text: string) {
  return /quiero|pedido|encargar|tarta|cajita|para\s/i.test(normalize(text))
}

function buildFlavorsReply() {
  const flavors = listFlavorsAndSizes()
  const lines = flavors.map((entry) => {
    const sizes = entry.sizes.map((size) => `${size.format}: ${size.priceText}`).join(" | ")
    return `- ${entry.flavor}: ${sizes}`
  })

  return `Siempre trabajamos con 2 tamaños: Tarta y Cajita.\n${lines.join("\n")}\n${POLICY_TEXT}`
}

function buildIngredientsReply(message: string) {
  const product = detectProductMention(message)
  if (!product) {
    return "Dime qué sabor quieres revisar y te paso ingredientes y alérgenos."
  }

  const detail = extractAllergensAndIngredients(product.fullDescription ?? product.shortDescription)
  const allergens = detail.allergens.length ? detail.allergens.join(", ") : "no lo veo en la ficha"
  const ingredients = detail.ingredients.length ? detail.ingredients.join(", ") : "no lo veo en la ficha"

  return `Para ${product.name}: ingredientes ${ingredients}. Alérgenos ${allergens}.`
}

function missingFieldsText(state: OrderState) {
  const missing: string[] = []
  if (!state.flavor) missing.push("sabor")
  if (!state.format) missing.push("formato (tarta o cajita)")
  if (!state.phone) missing.push("teléfono")

  if (!missing.length) return ""
  return `Me falta ${missing.join(", ")} para confirmar el pedido.`
}

async function activateHandoff(userId: string, reason?: string) {
  const until = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  await setPauseState(userId, until)
  return {
    handedOff: true,
    reason: reason ?? "Usuario pide asistencia humana",
    contact: {
      phone: process.env.HUMAN_SUPPORT_PHONE_E164 ?? null,
      whatsappLink: process.env.HUMAN_SUPPORT_WHATSAPP_LINK ?? null,
    },
    message: HANDOFF_TEXT,
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

  const pauseState = await getPauseState(userId)
  if (pauseState.botPausedUntil && pauseState.botPausedUntil > new Date()) {
    await saveMessage(userId, "user", message)
    await saveMessage(userId, "assistant", HANDOFF_TEXT)
    return { text: HANDOFF_TEXT }
  }

  await saveMessage(userId, "user", message)

  if (shouldRequestHandoff(message)) {
    const handoff = await activateHandoff(userId, "Solicitud explícita")
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

  if (hasScheduleIntent(message)) {
    return saveAndReply(userId, `${STORE_HOURS_TEXT} ${POLICY_TEXT}`)
  }

  if (hasAllergensIntent(message)) {
    return saveAndReply(userId, buildIngredientsReply(message))
  }

  if (hasFlavorsIntent(message) && !hasOrderIntent(message)) {
    return saveAndReply(userId, buildFlavorsReply())
  }

  const orderFlow = hasOrderIntent(message) || state.inOrderFlow || state.awaitingConfirm
  if (orderFlow) {
    state.inOrderFlow = true

    const product = detectProductMention(message)
    if (product) {
      state.flavor = product.category
      state.format = state.format ?? product.format
    }

    const format = parseFormat(message)
    if (format) {
      state.format = format
    }

    if (state.awaitingConfirm && isAffirmative(message) && state.suggestedDate) {
      state.finalDate = state.suggestedDate
      state.awaitingConfirm = false
    }

    if (state.awaitingConfirm && isNegative(message)) {
      state.awaitingConfirm = false
      state.suggestedDate = undefined
      state.finalDate = undefined
      return saveAndReply(userId, "Perfecto, dime para qué día la necesitas.", state)
    }

    const parsedDate = parseSpanishDesiredDate(message, now, SHOP_TZ)
    if (parsedDate?.kind === "ambiguous") {
      return saveAndReply(userId, parsedDate.question, state)
    }

    if (parsedDate?.kind === "date") {
      state.desiredDate = parsedDate.iso

      const earliest = earliestPickupDateISO(now, LEAD_DAYS, SHOP_TZ)
      if (parsedDate.iso < earliest) {
        state.suggestedDate = earliest
        state.finalDate = undefined
        state.awaitingConfirm = true

        return saveAndReply(
          userId,
          `Para ${formatDateEs(parsedDate.iso, SHOP_TZ)} no llegamos; primera disponible ${formatDateEs(earliest, SHOP_TZ)}. ¿Te va bien? ${STORE_HOURS_TEXT} Necesito tu teléfono para confirmar el pedido.`,
          state
        )
      }

      state.finalDate = parsedDate.iso
      state.suggestedDate = undefined
      state.awaitingConfirm = false
    }

    if (!state.finalDate) {
      return saveAndReply(userId, "¿Para qué día la necesitas?", state)
    }

    const missing = missingFieldsText(state)
    if (missing) {
      const dateText = `Puedes recogerla el ${formatDateEs(state.finalDate, SHOP_TZ)}. ¿A qué hora te viene bien dentro del horario?`
      const phoneHint = state.phone ? "" : " Necesito tu teléfono para confirmar el pedido."
      return saveAndReply(userId, `${dateText} ${missing}${phoneHint}`, state)
    }

    const created = await createChatOrder({
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

    const nextState: OrderState = { inOrderFlow: false }
    return saveAndReply(
      userId,
      `Pedido creado. Recogida el ${formatDateEs(created.deliveryDate, SHOP_TZ)}. Te enviaremos confirmación por WhatsApp/email si aplica. ${POLICY_TEXT}`,
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
      description: "Da ingredientes/alérgenos por sabor o slug",
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
        required: ["phone", "items"],
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
    if (name === "handoff_to_human") return activateHandoff(userId, String(args.reason ?? "handoff"))

    if (name === "get_product_info") {
      const product = findProductBySlugOrFlavor(String(args.query ?? ""))
      if (!product) {
        safetyEscalate = true
        return { found: false, message: "No encontré ese producto." }
      }

      const detail = extractAllergensAndIngredients(product.fullDescription ?? product.shortDescription)
      if (!detail.allergens.length) {
        safetyEscalate = true
      }

      return {
        found: true,
        product: {
          name: product.name,
          format: product.format,
          description: product.fullDescription ?? product.shortDescription,
          allergens: detail.allergens,
          ingredients: detail.ingredients,
          fallback: detail.allergens.length || detail.ingredients.length ? undefined : "no lo veo en la ficha",
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
    const handoff = await activateHandoff(userId, "Incertidumbre crítica")
    text = `${text}\n\n${handoff.message}`
  }

  await saveMessage(userId, "assistant", text)
  await maybeSummarizeConversation(openai, userId, [...context.messagesLastN, { role: "user", content: message }, { role: "assistant", content: text }])

  return { text }
}

