import "server-only"

import OpenAI from "openai"

import { cancelChatOrder, createChatOrder } from "@/lib/chatbot/orders"
import {
  extractAllergensAndIngredients,
  findProductBySlugOrFlavor,
  listFlavorsAndSizes,
} from "@/lib/chatbot/products"

type ChatMessage = { role: "user" | "assistant"; content: string }

type HandleMessageInput = {
  sessionId: string
  message: string
  phone?: string
  channel: "web" | "whatsapp"
}

const chatHistory = new Map<string, ChatMessage[]>()

const STORE_HOURS = process.env.STORE_HOURS ?? "Lunes a sábado de 09:00 a 19:00 (domingos cerrado)."

const SYSTEM_PROMPT = `Eres el asistente de SayCheese.
Habla en español, breve y amable.
Tus objetivos: horario de tienda, sabores/tamaños, ingredientes/alérgenos, crear pedidos y anular pedidos.
Nunca inventes alérgenos o ingredientes: si no aparecen en la ficha del producto responde exactamente: "no lo veo en la ficha".
Para crear pedido, exige teléfono obligatorio y email opcional.
Cuando te falten datos para crear o anular pedido, pídelos de forma clara.`

const TOOL_DEFINITIONS: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "get_store_hours",
    description: "Devuelve el horario de tienda",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_flavors_and_sizes",
    description: "Lista sabores disponibles y sus dos tamaños",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_product_info",
    description: "Obtiene información de un producto/sabor incluyendo ingredientes y alérgenos",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "slug o sabor" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_order",
    description: "Crea un pedido con teléfono obligatorio y email opcional",
    parameters: {
      type: "object",
      properties: {
        customer_name: { type: "string" },
        customer_email: { type: "string" },
        phone: { type: "string" },
        delivery_date: { type: "string", description: "YYYY-MM-DD" },
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
          minItems: 1,
        },
      },
      required: ["phone", "items"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "cancel_order",
    description: "Anula el pedido más reciente activo por teléfono",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string" },
        order_hint: { type: "string", description: "Prefijo opcional del id del pedido" },
      },
      required: ["phone"],
      additionalProperties: false,
    },
  },
]

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada")
  }

  return new OpenAI({ apiKey })
}

function getHistory(sessionId: string) {
  return chatHistory.get(sessionId) ?? []
}

function saveHistory(sessionId: string, messages: ChatMessage[]) {
  chatHistory.set(sessionId, messages.slice(-10))
}

async function runTool(name: string, args: Record<string, unknown>, fallbackPhone?: string) {
  switch (name) {
    case "get_store_hours":
      return { hours: STORE_HOURS }
    case "get_flavors_and_sizes":
      return { flavors: listFlavorsAndSizes() }
    case "get_product_info": {
      const query = String(args.query ?? "")
      const product = findProductBySlugOrFlavor(query)
      if (!product) {
        return { found: false, message: "No encontré ese sabor/producto." }
      }

      const details = extractAllergensAndIngredients(product.fullDescription ?? product.shortDescription)

      return {
        found: true,
        product: {
          name: product.name,
          slug: product.slug,
          format: product.format,
          description: product.fullDescription ?? product.shortDescription,
          allergens: details.allergens,
          ingredients: details.ingredients,
          noInfoMessage:
            details.allergens.length === 0 && details.ingredients.length === 0 ? "no lo veo en la ficha" : undefined,
        },
      }
    }
    case "create_order": {
      const phone = String(args.phone ?? fallbackPhone ?? "")
      const result = await createChatOrder({ ...args, phone })
      return { ok: true, ...result }
    }
    case "cancel_order": {
      const phone = String(args.phone ?? fallbackPhone ?? "")
      const orderHint = typeof args.order_hint === "string" ? args.order_hint : undefined
      return cancelChatOrder(phone, orderHint)
    }
    default:
      return { error: `Tool no soportada: ${name}` }
  }
}

export async function handleMessage({ sessionId, message, phone, channel }: HandleMessageInput) {
  const history = getHistory(sessionId)
  const openai = getOpenAIClient()
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini"

  const inputParts: OpenAI.Responses.ResponseInput = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((item) => ({ role: item.role, content: item.content })),
    {
      role: "user",
      content: `Canal: ${channel}.${phone ? ` Teléfono detectado: ${phone}.` : ""}\nMensaje: ${message}`,
    },
  ]

  let response = await openai.responses.create({
    model,
    input: inputParts,
    tools: TOOL_DEFINITIONS,
  })

  for (let index = 0; index < 4; index += 1) {
    const toolCalls = response.output.filter((item) => item.type === "function_call")

    if (!toolCalls.length) {
      break
    }

    const toolOutputs: OpenAI.Responses.ResponseInput = []

    for (const toolCall of toolCalls) {
      if (toolCall.type !== "function_call") continue

      const args = JSON.parse(toolCall.arguments || "{}") as Record<string, unknown>
      const result = await runTool(toolCall.name, args, phone)

      toolOutputs.push({
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: JSON.stringify(result),
      })
    }

    response = await openai.responses.create({
      model,
      previous_response_id: response.id,
      input: toolOutputs,
      tools: TOOL_DEFINITIONS,
    })
  }

  const text = response.output_text || "No pude generar una respuesta ahora mismo."

  saveHistory(sessionId, [...history, { role: "user", content: message }, { role: "assistant", content: text }])

  return { text }
}
