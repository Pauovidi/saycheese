type OrderPromptState = {
  flavor?: string
  format?: "tarta" | "cajita"
  customerName?: string
  phone?: string
}

type MissingFieldsPromptOptions = {
  preferContinuationTone?: boolean
}

export const ORDER_LOW_CONFIDENCE_RECOVERY = "No lo he entendido bien. ¿Puedes repetírmelo?"
export const MULTIPLE_CAKES_INTRO = "Perfecto. Te las voy apuntando una a una para no equivocarme. Vamos con la primera."
export const ADD_ANOTHER_CAKE_PROMPT = "¿Quieres cerrar el pedido o añadir otra tarta?"
export const NEXT_CAKE_PROMPT = "Perfecto. Vamos con la siguiente. Dime el sabor y el formato."

function hasValue(value?: string) {
  return typeof value === "string" && value.trim().length > 0
}

function uniqueMissingFields(state: OrderPromptState, channel: "web" | "whatsapp") {
  const missing = new Set<string>()

  if (!state.flavor) missing.add("el sabor")
  if (!state.format) missing.add("el formato")
  if (!hasValue(state.customerName)) missing.add("tu nombre")
  if (channel !== "whatsapp" && !hasValue(state.phone)) missing.add("tu teléfono")

  return [...missing]
}

function joinMissingFields(parts: string[]) {
  if (!parts.length) return ""
  if (parts.length === 1) return parts[0] ?? ""
  if (parts.length === 2) return `${parts[0]} y ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`
}

export function buildMissingFieldsPrompt(
  state: OrderPromptState,
  channel: "web" | "whatsapp",
  options?: MissingFieldsPromptOptions
) {
  const missing = uniqueMissingFields(state, channel)
  if (!missing.length) return ""
  const continuationTone = options?.preferContinuationTone ?? false

  if (hasValue(state.customerName) && missing.length === 1) {
    return `Solo me falta ${missing[0]} para confirmarlo.`
  }

  if (missing.length === 1 && missing[0] === "tu nombre") {
    return continuationTone
      ? "Para dejarlo confirmado me falta tu nombre."
      : "Para dejarlo confirmado necesito tu nombre."
  }

  if (missing.length === 1 && missing[0] === "tu teléfono") {
    return "Necesito tu teléfono para confirmar el pedido."
  }

  if (hasValue(state.customerName)) {
    return `Para dejarlo confirmado solo me faltan ${joinMissingFields(missing)}.`
  }

  if (continuationTone) {
    return `Para dejarlo confirmado me faltan ${joinMissingFields(missing)}.`
  }

  return `Para dejarlo confirmado necesito ${joinMissingFields(missing)}.`
}

export function buildContextualOrderReplyText(input: {
  customerName?: string
  itemLabel: string
  dateLabel?: string | null
  missingPrompt?: string
}) {
  const customerName = typeof input.customerName === "string" ? input.customerName.trim() : ""
  const salutationSuffix = customerName ? `, ${customerName}` : ""
  const prefix = input.dateLabel
    ? `De acuerdo${salutationSuffix}. Te apunto ${input.itemLabel} para el ${input.dateLabel}.`
    : `De acuerdo${salutationSuffix}.`

  if (!input.missingPrompt) {
    return prefix
  }

  return `${prefix} ${input.missingPrompt}`
}
