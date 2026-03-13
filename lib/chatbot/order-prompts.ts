type OrderPromptState = {
  flavor?: string
  format?: "tarta" | "cajita"
  phone?: string
}

function uniqueMissingFields(state: OrderPromptState) {
  const missing = new Set<string>()

  if (!state.flavor) missing.add("sabor")
  if (!state.format) missing.add("formato (grande o cajita)")
  if (!state.phone) missing.add("teléfono")

  return [...missing]
}

function joinMissingFields(parts: string[]) {
  if (!parts.length) return ""
  if (parts.length === 1) return parts[0] ?? ""
  if (parts.length === 2) return `${parts[0]} y ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`
}

export function buildMissingFieldsPrompt(state: OrderPromptState) {
  const missing = uniqueMissingFields(state)
  if (!missing.length) return ""

  if (missing.length === 1 && missing[0] === "teléfono") {
    return "Necesito tu teléfono para confirmar el pedido."
  }

  return `Me falta ${joinMissingFields(missing)} para confirmar el pedido.`
}
