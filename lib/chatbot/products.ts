import {
  buildHumanSupportMessage,
  getCustomerFacingFormatLabel,
  PICKUP_ONLY_COPY,
} from "@/src/data/business"
import { buildProductsFromFlavorRecords, getCakeFlavorAdminStatus, type EditableFlavorRecord, type Product } from "@/src/data/products"
import {
  getAdminCatalogFlavorRecords,
  getArchivedCatalogFlavorRecords,
  getCatalogFlavorFacts,
  getCatalogFlavors,
  getCatalogProductBySlug,
  getCatalogProducts,
  getCatalogProductsByCategory,
} from "@/src/data/products-store"

type ChatbotChannel = "web" | "whatsapp"

export type ChatbotFlavorSize = {
  format: "tarta" | "cajita"
  label: string
  priceText: string
}

export type ChatbotAvailableCakeFlavor = {
  flavor: string
  sizes: ChatbotFlavorSize[]
  isMonthlySpecial?: boolean
  isMonthlySpecialActive?: boolean
  monthlySpecialExpiresAt?: string | null
}

export type ChatbotCatalogForMessage = {
  flavors: string[]
  sizes: ChatbotFlavorSize[]
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

function stripNonFlavorTerms(query: string) {
  return normalize(query)
    .replace(/\b(quiero|pedido|encargar|para|una|un|de|la|el|por|favor|grande|tarta|cajita|caja|pequena|pequeña|pequeno|pequeño|mini|individual)\b/g, " ")
    .replace(/[^\p{L}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function detectRequestedFormat(query: string): Product["format"] | undefined {
  const normalized = normalize(query)
  if (/\bcajita\b/.test(normalized)) return "cajita"
  if (/\b(tarta|grande)\b/.test(normalized)) return "tarta"
  return undefined
}

function scoreFlavorMatch(query: string, product: Product) {
  const normalizedQuery = stripNonFlavorTerms(query)
  const fields = [product.slug, product.name, product.category].map(normalize)
  const haystack = fields.join(" ")

  if (fields.includes(normalizedQuery)) return 100
  if (fields.some((field) => normalizedQuery.includes(field))) return 80
  if (fields.some((field) => field.includes(normalizedQuery))) return 70

  const tokens = normalizedQuery.split(/\s+/).filter((token) => token.length >= 3)
  if (tokens.length && tokens.every((token) => haystack.includes(token))) {
    return 60
  }

  if (tokens.some((token) => token.length >= 4 && haystack.includes(token))) {
    return 55
  }

  return 0
}

export async function listFlavorsAndSizes() {
  const products = await getCatalogProducts()
  const grouped = new Map<string, ChatbotAvailableCakeFlavor>()

  for (const product of products) {
    const current = grouped.get(product.category) ?? {
      flavor: product.name,
      sizes: [],
      isMonthlySpecial: product.isMonthlySpecial,
      isMonthlySpecialActive: product.isMonthlySpecialActive,
      monthlySpecialExpiresAt: product.monthlySpecialExpiresAt,
    }
    current.sizes.push({
      format: product.format,
      label: getCustomerFacingFormatLabel(product.format),
      priceText: product.priceText,
    })
    current.isMonthlySpecial = current.isMonthlySpecial || product.isMonthlySpecial
    current.isMonthlySpecialActive = current.isMonthlySpecialActive || product.isMonthlySpecialActive
    current.monthlySpecialExpiresAt = current.monthlySpecialExpiresAt ?? product.monthlySpecialExpiresAt
    grouped.set(product.category, current)
  }

  return Array.from(grouped.values()).map((entry) => ({
    flavor: entry.flavor,
    sizes: entry.sizes.sort((a, b) => (a.format === "tarta" ? -1 : 1)),
    isMonthlySpecial: entry.isMonthlySpecial,
    isMonthlySpecialActive: entry.isMonthlySpecialActive,
    monthlySpecialExpiresAt: entry.monthlySpecialExpiresAt,
  }))
}

export async function getAvailableCakeFlavorsForChatbot() {
  return listFlavorsAndSizes()
}

function formatPriceTextList(priceTexts: string[]) {
  return Array.from(new Set(priceTexts.filter(Boolean))).join(" / ")
}

export function buildCatalogForMessage(flavors: ChatbotAvailableCakeFlavor[]): ChatbotCatalogForMessage {
  const sizesByFormat = new Map<ChatbotFlavorSize["format"], ChatbotFlavorSize>()

  for (const flavor of flavors) {
    for (const size of flavor.sizes) {
      const current = sizesByFormat.get(size.format)
      if (!current) {
        sizesByFormat.set(size.format, { ...size })
        continue
      }

      const priceText = formatPriceTextList([current.priceText, size.priceText])
      sizesByFormat.set(size.format, { ...current, priceText })
    }
  }

  return {
    flavors: flavors.map((flavor) => flavor.flavor),
    sizes: Array.from(sizesByFormat.values()).sort((a, b) => (a.format === "tarta" ? -1 : 1)),
  }
}

function formatSizePriceLine(size: ChatbotFlavorSize) {
  return `- ${size.label.charAt(0).toUpperCase()}${size.label.slice(1)}: ${size.priceText}`
}

export function buildFlavorListMessage(
  flavors: ChatbotAvailableCakeFlavor[],
  options: { includeGreeting?: boolean; channel?: ChatbotChannel; leadDays?: number } = {}
) {
  const includeGreeting = options.includeGreeting ?? false
  const channel = options.channel ?? "web"
  const leadDays = options.leadDays ?? 3
  const intro = includeGreeting ? "¡Hola! 🍰 " : "🍰 "

  if (!flavors.length) {
    return `${intro}Ahora mismo no hay sabores publicados en el catálogo. ${buildHumanSupportMessage(
      "Te atiende una persona del equipo para confirmarte disponibilidad aquí:",
      channel
    )}`
  }

  const catalog = buildCatalogForMessage(flavors)
  const monthlySpecial = flavors.find((flavor) => flavor.isMonthlySpecialActive)
  const flavorLines = catalog.flavors.map((flavor) => {
    const suffix = monthlySpecial?.flavor === flavor ? " (Tarta del mes)" : ""
    return `- ${flavor}${suffix}`
  })
  const sizeLines = catalog.sizes.map(formatSizePriceLine)
  const monthlySpecialIntro = monthlySpecial ? `Tarta del mes: ${monthlySpecial.flavor}.\n\n` : ""

  return `${intro}${monthlySpecialIntro}Tenemos estos sabores disponibles:
${flavorLines.join("\n")}

Trabajamos con 2 tamaños:
${sizeLines.join("\n")}

${PICKUP_ONLY_COPY}
Plazo mínimo: ${leadDays} días.`
}

export async function buildFlavorsAndSizesMessage(
  includeGreeting = false,
  options: { channel?: ChatbotChannel; leadDays?: number } = {}
) {
  return buildFlavorListMessage(await getAvailableCakeFlavorsForChatbot(), {
    includeGreeting,
    channel: options.channel,
    leadDays: options.leadDays,
  })
}

export async function findProductBySlugOrFlavor(q: string) {
  const exactSlug = await getCatalogProductBySlug(q)
  if (exactSlug) return exactSlug

  const searchableQuery = stripNonFlavorTerms(q)
  if (!searchableQuery) return undefined

  const products = await getCatalogProducts()
  const requestedFormat = detectRequestedFormat(q)
  const bestProduct = products
    .map((product) => ({ product, score: scoreFlavorMatch(searchableQuery, product) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || Number(Boolean(b.product.allergens)) - Number(Boolean(a.product.allergens)))[0]?.product

  if (!bestProduct) return undefined
  if (requestedFormat) {
    return (await getCatalogProductsByCategory(bestProduct.category)).find((product) => product.format === requestedFormat) ?? bestProduct
  }

  return (await getCatalogProductsByCategory(bestProduct.category)).find((product) => Boolean(product.allergens)) ?? bestProduct
}

export async function findExplicitFlavorSelection(query: string) {
  const searchableQuery = stripNonFlavorTerms(query)
  if (!searchableQuery) return undefined

  const normalizedQuery = normalize(searchableQuery)
  const flavors = await getCatalogFlavors()
  const exactFlavor = flavors.find(
    (flavor) =>
      normalize(flavor.category) === normalizedQuery ||
      normalize(flavor.label) === normalizedQuery
  )

  if (!exactFlavor) return undefined

  const flavorProducts = await getCatalogProductsByCategory(exactFlavor.category)
  return flavorProducts.find((product) => Boolean(product.allergens)) ?? flavorProducts[0]
}

export async function findFlavorFactsByQuery(q: string) {
  const product = await findProductBySlugOrFlavor(q)
  if (!product) return undefined
  return getCatalogFlavorFacts(product.category)
}

export async function isKnownFlavor(flavor: string) {
  const normalized = normalize(flavor)
  const flavors = await getCatalogFlavors()
  return flavors.some((flavorEntry) => normalize(flavorEntry.category) === normalized || normalize(flavorEntry.label) === normalized)
}

function bestRecordMatch(query: string, records: EditableFlavorRecord[]) {
  const products = buildProductsFromFlavorRecords(records)
  const match = products
    .map((product) => ({ product, score: scoreFlavorMatch(query, product) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || Number(Boolean(b.product.allergens)) - Number(Boolean(a.product.allergens)))[0]

  if (!match) return undefined
  return records.find((record) => record.slug === match.product.category)
}

export async function findUnavailableFlavorByQuery(query: string) {
  const availableFlavors = await getCatalogFlavors()
  const availableCategories = new Set(availableFlavors.map((flavor) => flavor.category))
  const [adminRecords, archivedRecords] = await Promise.all([
    getAdminCatalogFlavorRecords(),
    getArchivedCatalogFlavorRecords(),
  ])
  const unavailableRecords = [...adminRecords, ...archivedRecords].filter(
    (record) => !availableCategories.has(record.slug)
  )
  const match = bestRecordMatch(query, unavailableRecords)

  if (!match) return undefined

  return {
    flavor: match.name,
    category: match.slug,
    status: getCakeFlavorAdminStatus(match),
  }
}

export async function resolveFlavorAvailability(flavor: string) {
  if (await isKnownFlavor(flavor)) {
    return { available: true as const }
  }

  const unavailable = await findUnavailableFlavorByQuery(flavor)

  return {
    available: false as const,
    flavor: unavailable?.flavor ?? flavor,
    status: unavailable?.status ?? "despublicada",
  }
}

export async function buildUnavailableFlavorMessage(flavor: string, options: { channel?: ChatbotChannel } = {}) {
  const alternatives = (await listFlavorsAndSizes()).slice(0, 5).map((entry) => entry.flavor)
  const alternativeCopy = alternatives.length
    ? `Ahora mismo puedes pedir: ${alternatives.join(", ")}.`
    : buildHumanSupportMessage("Te atiende una persona del equipo para confirmarte alternativas aquí:", options.channel)

  return `Ahora mismo ${flavor} no está disponible para nuevos pedidos. ${alternativeCopy}`
}
