import "server-only"

import OpenAI from "openai"

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

export type ChatEngineError = Error & {
  status?: number
  code?: string
}

const STORE_HOURS = process.env.STORE_HOURS ?? "Lunes a sábado de 09:00 a 19:00 (domingos cerrado)."
const SUMMARY_THRESHOLD = 30

const SYSTEM_PROMPT = `Eres el asistente de SayCheese.
Responde en español, claro y breve.
No inventes alérgenos/ingredientes. Si no están en la ficha, di exactamente: "no lo veo en la ficha".
Pedidos: teléfono obligatorio, email opcional.
Si el usuario pide humano o hay incertidumbre crítica, usa tool handoff_to_human.`

const HANDOFF_TEXT =
  `Te paso con una persona del equipo. ` +
  `Puedes contactar en ${process.env.HUMAN_SUPPORT_PHONE_E164 ?? "(configurar HUMAN_SUPPORT_PHONE_E164)"}. ` +
  `${process.env.HUMAN_SUPPORT_WHATSAPP_LINK ? `WhatsApp: ${process.env.HUMAN_SUPPORT_WHATSAPP_LINK}` : ""}`

const HANDOFF_KEYWORDS = ["humano", "persona", "agente", "asesor", "operador"]
const RETRY_DELAYS_MS = [500, 1500] as const

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    const error = new Error("Missing OPENAI_API_KEY") as ChatEngineError
    error.status = 500
    error.code = "missing_openai_api_key"
    throw error
  }
  return new OpenAI({ apiKey })
}

function normalizeError(error: unknown): ChatEngineError {
  if (error instanceof Error) {
    return error as ChatEngineError
  }
  return new Error(typeof error === "string" ? error : "OpenAI request failed") as ChatEngineError
}

function isRetryableStatus(status?: number) {
  return status === 429 || status === 503
}

function withJitter(delayMs: number) {
  return delayMs + Math.floor(Math.random() * 250)
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createResponseWithRetry(openai: OpenAI, params: any) {
  let lastError: ChatEngineError | null = null

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt += 1) {
    try {
      return await openai.responses.create(params)
    } catch (error) {
      const normalized = normalizeError(error)
      const status = normalized.status

      if (!isRetryableStatus(status) || attempt >= RETRY_DELAYS_MS.length) {
        throw normalized
      }

      lastError = normalized
      await wait(withJitter(RETRY_DELAYS_MS[attempt]))
    }
  }

  throw lastError ?? new Error("OpenAI request failed")
}

function shouldRequestHandoff(message: string) {
  const normalized = message.toLowerCase()
  return HANDOFF_KEYWORDS.some((word) => normalized.includes(word))
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

  const summaryResponse = await createResponseWithRetry(openai, {
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

  const openAIInput: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(context.summary ? [{ role: "system", content: `Resumen persistente: ${context.summary}` }] : []),
    ...context.messagesLastN.map((item) => ({ role: item.role, content: item.content })),
    { role: "user", content: `Canal=${channel}. ${phone ? `Teléfono=${phone}.` : ""} Mensaje=${message}` },
  ]

  let response = await createResponseWithRetry(openai, { model, input: openAIInput, tools })

  for (let i = 0; i < 4; i += 1) {
    const calls = response.output.filter((entry) => entry.type === "function_call")
    if (!calls.length) break

    const outputs: any[] = []
    for (const call of calls) {
      if (call.type !== "function_call") continue
      const result = await toolRunner(call.name, call.arguments ?? "{}", phone)
      outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) })
    }

    response = await createResponseWithRetry(openai, {
      model,
      previous_response_id: response.id,
      input: outputs,
      tools,
    })
  }

  await setLastOpenAIResponseId(userId, response.id)

  let text = response.output_text?.trim() || "No pude responder ahora mismo."

  if (safetyEscalate) {
    const handoff = await activateHandoff(userId, "Incertidumbre crítica")
    text = `${text}\n\n${handoff.message}`
  }

  await saveMessage(userId, "assistant", text)
  await maybeSummarizeConversation(openai, userId, [...context.messagesLastN, { role: "user", content: message }, { role: "assistant", content: text }])

  return { text }
}
