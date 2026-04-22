export type OrderFormat = "tarta" | "cajita"

export function normalizeChatText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export function extractPhoneFromText(text: string) {
  const match = text.match(/(?:\+?\d[\d\s-]{6,}\d)/)
  if (!match) return undefined

  return match[0].replace(/\s+/g, "").replace(/-/g, "")
}

export function parseOrderFormat(text: string): OrderFormat | undefined {
  const normalized = normalizeChatText(text)
  if (/\b(cajita|caja|pequena|pequeña|pequeno|pequeño|mini|individual)\b/.test(normalized)) return "cajita"
  if (/\b(tarta|grande|mediana|mediano)\b/.test(normalized)) return "tarta"
  return undefined
}

function cleanCustomerNameCandidate(value: string) {
  return value.replace(/^[\s,:-]+|[\s,.!?;:]+$/g, "").replace(/\s+/g, " ").trim()
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

  return normalizeChatText(cleanedText) === normalizeChatText(candidate)
}

type ExtractCustomerNameOptions = {
  blockedNormalizedTerms?: string[]
  allowSegmentExtraction?: boolean
}

export type AdditionalCakeDecisionIntent = "close" | "add" | "unknown"

function isLowConfidenceStandaloneName(word: string) {
  const normalized = normalizeChatText(word)
  if (!normalized) return true
  if (!/[aeiouy]/.test(normalized)) return true
  if (/(.)\1\1/.test(normalized)) return true
  if (normalized.length >= 6 && /^(.{2,3})\1+$/.test(normalized)) return true
  return false
}

function isLikelyCustomerName(value: string, options?: ExtractCustomerNameOptions) {
  const trimmed = cleanCustomerNameCandidate(splitNameCandidate(value))
  if (!trimmed) return false
  if (trimmed.length < 2 || trimmed.length > 60) return false
  if (/@/.test(trimmed) || /\d/.test(trimmed)) return false
  const normalizedTrimmed = normalizeChatText(trimmed)
  const blockedNormalizedTerms = new Set((options?.blockedNormalizedTerms ?? []).map((term) => normalizeChatText(term)))

  const words = trimmed.split(/\s+/)
  if (words.length > 4) return false
  if (!words.every((word) => /^[\p{L}'-]+$/u.test(word))) return false

  const blockedPhrases = new Set([
    "buenos dias",
    "buenas tardes",
    "buenas noches",
    "hola buenos dias",
    "hola buenas",
    "ya esta",
    "ya está",
    "cerrar pedido",
    "cerrar el pedido",
    "pedido cerrado",
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
  if (blockedPhrases.has(normalizedTrimmed) || blockedNormalizedTerms.has(normalizedTrimmed)) return false

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
    "grande",
    "pequena",
    "pequeña",
    "pequeno",
    "pequeño",
    "ya",
    "esta",
    "está",
    "listo",
    "cerrar",
    "cerrado",
    "confirmar",
    "finalizar",
    "terminar",
    "blabla",
    "asdf",
    "prueba",
    "test",
  ])

  for (const blockedTerm of blockedNormalizedTerms) {
    blocked.add(blockedTerm)
  }

  if (words.length === 1 && isLowConfidenceStandaloneName(words[0] ?? "")) {
    return false
  }

  return !words.some((word) => blocked.has(normalizeChatText(word)))
}

function extractNameFromSegment(segment: string, options?: ExtractCustomerNameOptions) {
  const candidate = cleanCustomerNameCandidate(splitNameCandidate(segment))
  return isLikelyCustomerName(candidate, options) ? candidate : undefined
}

export function extractCustomerName(text: string, options?: ExtractCustomerNameOptions) {
  const allowSegmentExtraction = options?.allowSegmentExtraction ?? true
  const patterns = [
    /(?:me\s+llamo|soy)\s+(.+)/i,
    /mi\s+nombre\s+es\s+(.+)/i,
    /a\s+nombre\s+de\s+(.+)/i,
    /^nombre\s*[:\-]?\s*(.+)$/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    const candidate = extractNameFromSegment(match?.[1] ?? "", options)
    if (candidate) {
      return candidate
    }
  }

  if (allowSegmentExtraction) {
    const segments = text
      .split(/[.!?;\n]+/)
      .map((segment) => segment.trim())
      .filter(Boolean)

    for (const segment of segments) {
      if (parseOrderFormat(segment) || extractPhoneFromText(segment) || /@/.test(segment)) {
        continue
      }

      const candidate = extractNameFromSegment(segment, options)
      if (candidate) {
        return candidate
      }
    }
  }

  const directCandidate = cleanCustomerNameCandidate(splitNameCandidate(text))
  if (isStandaloneNameMessage(text, directCandidate) && isLikelyCustomerName(directCandidate, options)) {
    return directCandidate
  }

  return undefined
}

export function hasExplicitNewOrderIntent(text: string) {
  const normalized = normalizeChatText(text)
  return [
    /\bnuevo\s+pedido\b/,
    /\botro\s+pedido\b/,
    /\bquiero\s+otro\b/,
    /\bhaz\s+otro\b/,
    /\bademas\s+quiero\b/,
    /\bademas\s+necesito\b/,
  ].some((pattern) => pattern.test(normalized))
}

export function hasMultipleCakeOrderIntent(text: string) {
  const normalized = normalizeChatText(text)
  return [
    /\b(?:dos|2|tres|3|cuatro|4)\s+(?:tartas|cajitas)\b/,
    /\bvarias\s+(?:tartas|cajitas)\b/,
    /\bmas\s+de\s+una\s+(?:tarta|cajita)\b/,
  ].some((pattern) => pattern.test(normalized))
}

export function hasAddAnotherCakeIntent(text: string) {
  const normalized = normalizeChatText(text)
  return [
    /\banadir\s+otra\b/,
    /\bquiero\s+otra\b/,
    /\botra\s+(?:tarta|cajita)\b/,
    /\buna\s+mas\b/,
    /\bsumar\s+otra\b/,
  ].some((pattern) => pattern.test(normalized))
}

export function hasCloseOrderIntent(text: string) {
  const normalized = normalizeChatText(text)
  return [
    /\bya\s+esta\b/,
    /\bya\s+estaria\b/,
    /\bvale\b/,
    /\bok(?:ay)?\b/,
    /\blisto\b/,
    /\bcerrar(?:\s+el\s+pedido)?\b/,
    /\bconfirmar(?:\s+el\s+pedido)?\b/,
    /\bfinalizar\b/,
    /\bterminar\b/,
    /\beso\s+es\s+todo\b/,
    /\bnada\s+mas\b/,
    /\bsolo\s+esa\b/,
  ].some((pattern) => pattern.test(normalized))
}

export function getAdditionalCakeDecisionIntent(text: string): AdditionalCakeDecisionIntent {
  if (hasCloseOrderIntent(text)) return "close"
  if (hasAddAnotherCakeIntent(text)) return "add"
  return "unknown"
}

export function hasRecentOrderGuard(previousCreatedAt?: string, now = new Date(), windowMs = 30 * 60 * 1000) {
  if (!previousCreatedAt) return false

  const previousTime = new Date(previousCreatedAt).getTime()
  if (!Number.isFinite(previousTime)) return false

  return now.getTime() - previousTime <= windowMs
}
