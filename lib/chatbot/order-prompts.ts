type OrderPromptState = {
  flavor?: string
  format?: "tarta" | "cajita"
  customerName?: string
  phone?: string
}

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

export function buildMissingFieldsPrompt(state: OrderPromptState, channel: "web" | "whatsapp") {
  const missing = uniqueMissingFields(state, channel)
  if (!missing.length) return ""

  if (hasValue(state.customerName) && missing.length === 1) {
    return `Solo me falta ${missing[0]} para confirmarlo.`
  }

  if (missing.length === 1 && missing[0] === "tu nombre") {
    return "Para dejarlo confirmado necesito tu nombre."
  }

  if (missing.length === 1 && missing[0] === "tu teléfono") {
    return "Necesito tu teléfono para confirmar el pedido."
  }

  if (hasValue(state.customerName)) {
    return `Para dejarlo confirmado solo me faltan ${joinMissingFields(missing)}.`
  }

  return `Para dejarlo confirmado necesito ${joinMissingFields(missing)}.`
}
