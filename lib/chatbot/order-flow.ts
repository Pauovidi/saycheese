import { formatDateEs, parseSpanishDesiredDate, resolveRequestedPickupDate } from "@/lib/chatbot/date-rules"
import { appendOrderItem, type ChatOrderItem } from "@/lib/chatbot/order-dedupe"
import {
  extractCustomerName,
  extractPhoneFromText,
  getAdditionalCakeDecisionIntent,
  hasExplicitNewOrderIntent,
  hasMultipleCakeOrderIntent,
  hasRecentOrderGuard,
  normalizeChatText,
  parseOrderFormat,
} from "@/lib/chatbot/order-intake"
import {
  ADD_ANOTHER_CAKE_PROMPT,
  buildContextualOrderReplyText,
  buildMissingFieldsPrompt,
  MULTIPLE_CAKES_INTRO,
  NEXT_CAKE_PROMPT,
  ORDER_LOW_CONFIDENCE_RECOVERY,
} from "@/lib/chatbot/order-prompts"
import {
  buildAmbiguousFlavorMessage,
  buildFlavorsAndSizesMessage,
  buildUnavailableFlavorMessage,
  findFlavorFactsByQuery,
  findProductBySlugOrFlavor,
  findUnavailableFlavorByQuery,
  resolveAvailableFlavorSelection,
  type FlavorSelectionResult,
} from "@/lib/chatbot/products"
import {
  CLOSED_PICKUP_DAYS_COPY,
  STORE_HOURS_TEXT,
} from "@/src/data/business"
import type { Product } from "@/src/data/products"

export type OrderState = {
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

export type OrderFlowResult =
  | { kind: "unhandled"; state: OrderState }
  | { kind: "reply"; text: string; state: OrderState }
  | { kind: "finalize"; state: OrderState }

type OrderFlowDependencies = {
  buildFlavorsReply?: (includeGreeting: boolean, channel: "web" | "whatsapp") => Promise<string>
  buildUnavailableFlavorMessage?: (flavor: string, options: { channel?: "web" | "whatsapp" }) => Promise<string>
  findFlavorFactsByQuery?: (query: string) => Promise<Awaited<ReturnType<typeof findFlavorFactsByQuery>>>
  findProductBySlugOrFlavor?: (query: string) => Promise<Product | undefined>
  findUnavailableFlavorByQuery?: (query: string) => Promise<{ flavor: string; category: string; status: string } | undefined>
  resolveAvailableFlavorSelection?: (query: string) => Promise<FlavorSelectionResult>
}

export type ProcessOrderConversationTurnInput = {
  message: string
  channel: "web" | "whatsapp"
  state: OrderState
  now: Date
  isOpeningConversation: boolean
  leadDays: number
  shopTz: string
  phone?: string
  deps?: OrderFlowDependencies
}

function normalize(text: string) {
  return normalizeChatText(text)
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

function hasFlavorsIntent(text: string) {
  return /sabor|tamano|tamaño|formato|tarta|grande|cajita|precio/i.test(normalize(text))
}

function hasOrderIntent(text: string) {
  return /quiero|pedido|encargar|tarta|grande|cajita|para\s/i.test(normalize(text))
}

function blockedCustomerNameTermsForProduct(product?: Product) {
  if (!product) return []

  const terms = new Set([product.name, product.category])
  for (const value of [product.name, product.category]) {
    for (const token of normalize(value).split(/[^a-z0-9]+/).filter((entry) => entry.length >= 3)) {
      terms.add(token)
    }
  }

  return Array.from(terms)
}

async function detectProductMention(text: string, deps: Required<OrderFlowDependencies>) {
  const directSelection = await deps.resolveAvailableFlavorSelection(text)
  if (directSelection.kind === "matched") return directSelection.product
  return undefined
}

async function buildOrderItemLabel(state: OrderState, deps: Required<OrderFlowDependencies>) {
  if (!state.flavor) return state.format === "cajita" ? "una cajita" : state.format === "tarta" ? "una grande" : "el pedido"

  const flavorFacts = await deps.findFlavorFactsByQuery(state.flavor)
  const product = await deps.findProductBySlugOrFlavor(state.flavor)
  const flavorLabel = flavorFacts?.label ?? product?.name ?? state.flavor.replace(/-/g, " ")
  if (state.format === "cajita") return `una cajita de ${flavorLabel}`
  if (state.format === "tarta") return `una grande de ${flavorLabel}`
  return `el pedido de ${flavorLabel}`
}

export function buildCurrentCakeItem(state: OrderState): ChatOrderItem | null {
  if (!state.flavor || !state.format) {
    return null
  }

  return {
    type: state.format === "cajita" ? "box" : "cake",
    flavor: state.flavor,
    qty: 1,
  }
}

export function buildPendingOrderItems(state: OrderState) {
  return state.pendingItems ?? []
}

async function buildContextualOrderReply(
  state: OrderState,
  channel: "web" | "whatsapp",
  tz: string,
  deps: Required<OrderFlowDependencies>
) {
  const itemLabel = await buildOrderItemLabel(state, deps)
  const dateLabel = state.finalDate ? formatDateEs(state.finalDate, tz) : null
  const missing = buildMissingFieldsPrompt(state, channel, { preferContinuationTone: Boolean(state.finalDate || state.flavor || state.format) })

  return buildContextualOrderReplyText({
    customerName: state.customerName,
    itemLabel,
    dateLabel,
    missingPrompt: missing,
  })
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

function defaultBuildFlavorsReply(includeGreeting: boolean, channel: "web" | "whatsapp") {
  const leadDays = Number.parseInt(process.env.CHATBOT_LEAD_DAYS ?? "3", 10)
  return buildFlavorsAndSizesMessage(includeGreeting, {
    channel,
    leadDays: Number.isFinite(leadDays) && leadDays > 0 ? leadDays : 3,
  })
}

function withDefaultDeps(deps: OrderFlowDependencies | undefined): Required<OrderFlowDependencies> {
  return {
    buildFlavorsReply: deps?.buildFlavorsReply ?? defaultBuildFlavorsReply,
    buildUnavailableFlavorMessage: deps?.buildUnavailableFlavorMessage ?? buildUnavailableFlavorMessage,
    findFlavorFactsByQuery: deps?.findFlavorFactsByQuery ?? findFlavorFactsByQuery,
    findProductBySlugOrFlavor: deps?.findProductBySlugOrFlavor ?? findProductBySlugOrFlavor,
    findUnavailableFlavorByQuery: deps?.findUnavailableFlavorByQuery ?? findUnavailableFlavorByQuery,
    resolveAvailableFlavorSelection: deps?.resolveAvailableFlavorSelection ?? resolveAvailableFlavorSelection,
  }
}

export async function processOrderConversationTurn(input: ProcessOrderConversationTurnInput): Promise<OrderFlowResult> {
  const deps = withDefaultDeps(input.deps)
  const { channel, isOpeningConversation, leadDays, message, now, shopTz, state } = input
  const messagePhone = input.phone ?? extractPhoneFromText(message)

  if (messagePhone) {
    state.phone = messagePhone
  }

  const email = extractEmailFromText(message)
  if (email) {
    state.customerEmail = email
  }

  const flavorSelection = await deps.resolveAvailableFlavorSelection(message)
  const explicitFlavorSelection = flavorSelection.kind === "matched" ? flavorSelection.product : undefined
  const activeOrder = state.inOrderFlow || state.awaitingConfirm || state.awaitingName || state.awaitingAdditionalCakeDecision

  if (hasFlavorsIntent(message) && !hasOrderIntent(message) && !explicitFlavorSelection) {
    if (activeOrder || hasMeaningfulOrderProgress(state)) {
      state.inOrderFlow = true
    }

    return {
      kind: "reply",
      text: await deps.buildFlavorsReply(isOpeningConversation, channel),
      state,
    }
  }

  const orderFlow =
    hasOrderIntent(message) ||
    activeOrder ||
    Boolean(explicitFlavorSelection)

  if (!orderFlow) {
    return { kind: "unhandled", state }
  }

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
    return {
      kind: "reply",
      text: 'Tu último pedido ya quedó creado. Si quieres iniciar otro, escribe "nuevo pedido" y dime sabor, tamaño y fecha.',
      state,
    }
  }

  state.inOrderFlow = true
  const multipleCakeIntro =
    hasMultipleCakeOrderIntent(message) && !state.expectsMultipleCakes && !buildPendingOrderItems(state).length
      ? MULTIPLE_CAKES_INTRO
      : null
  if (multipleCakeIntro) {
    state.expectsMultipleCakes = true
  }

  if (flavorSelection.kind === "ambiguous") {
    return {
      kind: "reply",
      text: mergeIntroReply(multipleCakeIntro, buildAmbiguousFlavorMessage(flavorSelection.choices)),
      state,
    }
  }

  const product = explicitFlavorSelection ?? await detectProductMention(message, deps)
  const unavailableFlavor = product ? undefined : await deps.findUnavailableFlavorByQuery(message)
  if (unavailableFlavor) {
    return {
      kind: "reply",
      text: await deps.buildUnavailableFlavorMessage(unavailableFlavor.flavor, { channel }),
      state,
    }
  }

  const format = parseOrderFormat(message)
  const parsedDate = parseSpanishDesiredDate(message, now, shopTz)
  const genericMessage = isGenericNonOperationalMessage(message)
  const additionalCakeDecisionIntent = state.awaitingAdditionalCakeDecision ? getAdditionalCakeDecisionIntent(message) : "unknown"
  const customerName =
    additionalCakeDecisionIntent === "close"
      ? undefined
      : extractCustomerName(message, {
          blockedNormalizedTerms: blockedCustomerNameTermsForProduct(product),
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
      return { kind: "finalize", state }
    }

    if (wantsAddAnotherCake) {
      state.awaitingAdditionalCakeDecision = false
      state.expectsMultipleCakes = true
      resetCurrentCakeSelection(state)

      if (!product && !format && !parsedDate) {
        return { kind: "reply", text: NEXT_CAKE_PROMPT, state }
      }
    } else if (!hasStructuredContribution) {
      return { kind: "reply", text: ORDER_LOW_CONFIDENCE_RECOVERY, state }
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
    return { kind: "reply", text: "Perfecto, dime para qué día la necesitas.", state }
  }

  if (parsedDate?.kind === "ambiguous") {
    return { kind: "reply", text: mergeIntroReply(multipleCakeIntro, parsedDate.question), state }
  }

  if (parsedDate?.kind === "date") {
    const resolution = resolveRequestedPickupDate(parsedDate.iso, now, leadDays, shopTz)
    state.desiredDate = parsedDate.iso

    if (resolution.kind === "too_soon") {
      state.suggestedDate = resolution.earliestDate
      state.finalDate = undefined
      state.awaitingConfirm = true

      return {
        kind: "reply",
        text: mergeIntroReply(
          multipleCakeIntro,
          `Aún no llegamos a ${formatDateEs(resolution.requestedDate, shopTz)} porque trabajamos con un mínimo de ${leadDays} días. La primera fecha disponible sería ${formatDateEs(resolution.earliestDate, shopTz)}. ¿Te va bien?\n${STORE_HOURS_TEXT}`
        ),
        state,
      }
    }

    if (resolution.kind === "closed") {
      state.suggestedDate = resolution.nextAvailableDate
      state.finalDate = undefined
      state.awaitingConfirm = true

      return {
        kind: "reply",
        text: mergeIntroReply(
          multipleCakeIntro,
          `No, el ${formatDateEs(resolution.requestedDate, shopTz)} no hacemos recogidas porque ${CLOSED_PICKUP_DAYS_COPY}. La siguiente fecha disponible sería ${formatDateEs(resolution.nextAvailableDate, shopTz)}. Si te va bien, te lo apunto para ese día.`
        ),
        state,
      }
    }

    if (resolution.kind === "invalid") {
      state.finalDate = undefined

      return {
        kind: "reply",
        text: mergeIntroReply(multipleCakeIntro, "No pude validar esa fecha. Dímela como 30/04, 30 de abril o jueves."),
        state,
      }
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
    return { kind: "reply", text: ORDER_LOW_CONFIDENCE_RECOVERY, state }
  }

  if (!state.finalDate) {
    return {
      kind: "reply",
      text: mergeIntroReply(
        multipleCakeIntro,
        "¿Para qué día la necesitas? Puedes decirme una fecha como 16/03, el 18 o un día de la semana."
      ),
      state,
    }
  }

  if (!hasNonEmptyValue(state.customerName) && state.flavor && state.format) {
    state.awaitingName = true
    return { kind: "reply", text: mergeIntroReply(multipleCakeIntro, await buildContextualOrderReply(state, channel, shopTz, deps)), state }
  }

  const missing = buildMissingFieldsPrompt(state, channel, { preferContinuationTone: true })
  if (missing) {
    return { kind: "reply", text: mergeIntroReply(multipleCakeIntro, await buildContextualOrderReply(state, channel, shopTz, deps)), state }
  }

  if (!hasNonEmptyValue(state.customerName)) {
    state.awaitingName = true
    return { kind: "reply", text: mergeIntroReply(multipleCakeIntro, await buildContextualOrderReply(state, channel, shopTz, deps)), state }
  }

  const currentCakeItem = buildCurrentCakeItem(state)
  if (currentCakeItem) {
    const completedCakeReply = await buildContextualOrderReply(state, channel, shopTz, deps)
    state.pendingItems = appendOrderItem(buildPendingOrderItems(state), currentCakeItem)
    resetCurrentCakeSelection(state)
    state.awaitingAdditionalCakeDecision = true

    return {
      kind: "reply",
      text: mergeIntroReply(multipleCakeIntro, `${completedCakeReply} ${ADD_ANOTHER_CAKE_PROMPT}`),
      state,
    }
  }

  if (state.awaitingAdditionalCakeDecision && buildPendingOrderItems(state).length) {
    return { kind: "reply", text: mergeIntroReply(multipleCakeIntro, ADD_ANOTHER_CAKE_PROMPT), state }
  }

  return { kind: "unhandled", state }
}
