import "server-only"

import OpenAI from "openai"

import { computeEarliestPickupDate, hasSpanishDateIntent, parseSpanishRequestedDate, validateOrSuggestDate } from "@/lib/chatbot/dates"
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

const STORE_HOURS = process.env.STORE_HOURS ?? "Lunes a sábado de 09:00 a 19:00 (domingos cerrado)."
const SUMMARY_THRESHOLD = 30
const CHATBOT_TIMEZONE = process.env.CHATBOT_TIMEZONE ?? "Europe/Madrid"

const SYSTEM_PROMPT = `Eres el asistente de SayCheese.
Responde en español, claro y breve.
No inventes alérgenos/ingredientes. Si no están en la ficha, di exactamente: "no lo veo en la ficha".
Pedidos: teléfono obligatorio, email opcional.
No se hacen envíos; solo recogida en tienda.
Nunca uses "recogerte"; usa "recogerla" o "recoger".
Plazo mínimo de 3 días; valida cualquier fecha solicitada.
Si no puedes interpretar una fecha pedida por el usuario, pregunta exactamente: "¿para qué día la necesitas?".
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

function shouldRequestHandoff(message: string) {
  const normalized = message.toLowerCase()
  return HANDOFF_KEYWORDS.some((word) => normalized.includes(word))
}

function sanitizeAssistantText(text: string) {
  return text.replace(/\brecogerte\b/gi, "recogerla")
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
    model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
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

export async function handleMessage({ sessionId, message, phone, channel }: HandleMessageInput) {
  const openai = getOpenAIClient()
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini"

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

  const now = new Date()
  const earliestPickupDate = computeEarliestPickupDate(now, CHATBOT_TIMEZONE)
  const requestedDate = parseSpanishRequestedDate(message, now, CHATBOT_TIMEZONE).requestedDate
  const hasDateIntent = hasSpanishDateIntent(message)
  const dateValidation = requestedDate ? validateOrSuggestDate(requestedDate, earliestPickupDate) : undefined

  if (hasDateIntent && !requestedDate) {
    const text = "¿para qué día la necesitas?"
    await saveMessage(userId, "assistant", text)
    await maybeSummarizeConversation(openai, userId, [...context.messagesLastN, { role: "user", content: message }, { role: "assistant", content: text }])
    return { text }
  }

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

    if (name === "get_store_hours") return { hours: STORE_HOURS }
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

  const dateContextLine = requestedDate
    ? `Fecha solicitada interpretada: ${requestedDate}. Fecha minima permitida: ${earliestPickupDate}. Resultado validacion: ${dateValidation?.ok ? "valida" : "inferior a minima"}.`
    : `Fecha minima permitida para recogida: ${earliestPickupDate}.`

  const openAIInput: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Contexto de fecha (${CHATBOT_TIMEZONE}): ${dateContextLine}` },
    ...(context.summary ? [{ role: "system", content: `Resumen persistente: ${context.summary}` }] : []),
    ...context.messagesLastN.map((item) => ({ role: item.role, content: item.content })),
    { role: "user", content: `Canal=${channel}. ${phone ? `Teléfono=${phone}.` : ""} Mensaje=${message}` },
  ]

  let response = await openai.responses.create({ model, input: openAIInput, tools })

  for (let i = 0; i < 4; i += 1) {
    const calls = response.output.filter((entry) => entry.type === "function_call")
    if (!calls.length) break

    const outputs: any[] = []
    for (const call of calls) {
      if (call.type !== "function_call") continue
      const result = await toolRunner(call.name, call.arguments ?? "{}", phone)
      outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) })
    }

    response = await openai.responses.create({ model, previous_response_id: response.id, input: outputs, tools })
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
