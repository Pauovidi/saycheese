import {
  buildHumanSupportMessage,
  getCustomerFacingFormatLabel,
  PICKUP_ONLY_COPY,
} from "@/src/data/business"
import {
  buildProductsFromFlavorRecords,
  getCakeFlavorAdminStatus,
  getFlavorsFromProducts,
  type EditableFlavorRecord,
  type Product,
} from "@/src/data/products"
import {
  getAdminCatalogFlavorRecords,
  getArchivedCatalogFlavorRecords,
  getCatalogFlavorFacts,
  getCatalogProducts,
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

export type FlavorSelectionResult =
  | { kind: "none" }
  | { kind: "matched"; product: Product }
  | { kind: "ambiguous"; query: string; choices: { category: string; label: string }[] }

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

function includesUnsafeCatalogTerm(...values: Array<string | null | undefined>) {
  const normalized = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => normalize(value).replace(/[-_]+/g, " "))
    .join(" ")

  return /\bauditoria\s+temporal\b/.test(normalized) || /\b(codex|fixture|test|debug)\b/.test(normalized)
}

export function isUnsafeChatbotCatalogName(value?: string | null) {
  return includesUnsafeCatalogTerm(value)
}

function isSafeChatbotProduct(product: Product) {
  return !includesUnsafeCatalogTerm(product.name, product.slug, product.category)
}

function isSafeChatbotRecord(record: EditableFlavorRecord) {
  return !includesUnsafeCatalogTerm(record.name, record.slug)
}

type CakeCatalogProduct = Product & { format: "tarta" | "cajita" }

function isCakeCatalogProduct(product: Product): product is CakeCatalogProduct {
  return product.format === "tarta" || product.format === "cajita"
}

function filterSafeChatbotProducts(products: Product[]): CakeCatalogProduct[] {
  return products.filter(isCakeCatalogProduct).filter(isSafeChatbotProduct)
}

async function getSafeCatalogProducts() {
  return filterSafeChatbotProducts(await getCatalogProducts())
}

function safeFlavorLabelForReply(flavor: string) {
  return isUnsafeChatbotCatalogName(flavor) ? "ese sabor" : flavor
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
  if (/\b(cajita|caja|pequena|pequeno|mini|individual)\b/.test(normalized)) return "cajita"
  if (/\b(tarta|grande|mediana|mediano)\b/.test(normalized)) return "tarta"
  return undefined
}

function findClassicFlavorProduct(products: Product[], requestedFormat?: Product["format"]) {
  const classicCategories = new Set(["clasica", "clasico", "classic", "original"])
  const classicProducts = products.filter((product) => {
    const fields = [product.category, product.slug, product.name].map(normalize)
    return fields.some((field) => classicCategories.has(field) || /\bclasica\b|\bclasico\b|\boriginal\b/.test(field))
  })

  if (!classicProducts.length) return undefined
  return selectProductForCategory(products, classicProducts[0]?.category ?? "", requestedFormat)
}

function isGenericClassicFlavorQuery(query: string) {
  const normalized = normalize(query).replace(/[^\p{L}\d\s]+/gu, " ").replace(/\s+/g, " ").trim()
  if (!normalized) return false
  if (/\bqueso\s+azul\b/.test(normalized)) return false

  const withoutOrderTerms = normalized
    .replace(/\b(hola|buenas|buenos|dias|tardes|noches|quiero|queria|necesito|busco|pedido|encargar|para|una|un|de|la|el|por|favor|grande|tarta|cajita|caja|pequena|pequeno|mini|individual|mediana|mediano|cheesecake)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return (
    /\btarta\s+de\s+queso\b/.test(normalized) ||
    /\b(?:de|sabor)\s+queso\b/.test(normalized) ||
    /\bcheesecake\b/.test(normalized) ||
    /\bclasica\b/.test(normalized) ||
    /\bclasico\b/.test(normalized) ||
    /\bla\s+normal\b/.test(normalized) ||
    /\bla\s+de\s+siempre\b/.test(normalized) ||
    /\boriginal\b/.test(normalized) ||
    withoutOrderTerms === "queso"
  )
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

function labelForProduct(product: Product) {
  return product.name
}

function uniqueFlavorChoices(entries: Array<{ product: Product; score: number }>) {
  const choices = new Map<string, { category: string; label: string; score: number }>()

  for (const entry of entries) {
    const existing = choices.get(entry.product.category)
    if (!existing || entry.score > existing.score) {
      choices.set(entry.product.category, {
        category: entry.product.category,
        label: labelForProduct(entry.product),
        score: entry.score,
      })
    }
  }

  return Array.from(choices.values()).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "es"))
}

function selectProductForCategory(products: Product[], category: string, requestedFormat?: Product["format"]) {
  const categoryProducts = products.filter((product) => product.category === category)
  if (!categoryProducts.length) return undefined

  if (requestedFormat) {
    return categoryProducts.find((product) => product.format === requestedFormat) ?? categoryProducts[0]
  }

  return categoryProducts.find((product) => Boolean(product.allergens)) ?? categoryProducts[0]
}

export function resolveFlavorSelectionFromProducts(query: string, sourceProducts: Product[]): FlavorSelectionResult {
  const products = filterSafeChatbotProducts(sourceProducts)
  const normalizedRawQuery = normalize(query)
  const requestedFormat = detectRequestedFormat(query)
  const exactSlug = products.find((product) => normalize(product.slug) === normalizedRawQuery)

  if (exactSlug) {
    return {
      kind: "matched",
      product: selectProductForCategory(products, exactSlug.category, requestedFormat) ?? exactSlug,
    }
  }

  if (isGenericClassicFlavorQuery(query)) {
    const classicProduct = findClassicFlavorProduct(products, requestedFormat)
    if (classicProduct) {
      return { kind: "matched", product: classicProduct }
    }
  }

  const searchableQuery = stripNonFlavorTerms(query)
  if (!searchableQuery) return { kind: "none" }

  const matches = products
    .map((product) => ({ product, score: scoreFlavorMatch(searchableQuery, product) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || Number(Boolean(b.product.allergens)) - Number(Boolean(a.product.allergens)))

  if (!matches.length) return { kind: "none" }

  const choices = uniqueFlavorChoices(matches)
  const strongPartialChoices = choices.filter((choice) => choice.score >= 70)

  if (strongPartialChoices.length > 1 && strongPartialChoices[1]?.score === strongPartialChoices[0]?.score) {
    return {
      kind: "ambiguous",
      query: searchableQuery,
      choices: strongPartialChoices.slice(0, 5).map(({ category, label }) => ({ category, label })),
    }
  }

  const best = matches[0]
  if (!best) return { kind: "none" }

  return {
    kind: "matched",
    product: selectProductForCategory(products, best.product.category, requestedFormat) ?? best.product,
  }
}

export function buildAmbiguousFlavorMessage(choices: { label: string }[]) {
  const labels = Array.from(new Set(choices.map((choice) => choice.label).filter((label) => !isUnsafeChatbotCatalogName(label))))

  if (!labels.length) {
    return "Tengo más de un sabor parecido. Dime el nombre completo del sabor, por favor."
  }

  return `Tengo más de un sabor parecido. ¿Te refieres a ${labels.join(" o ")}?`
}

export async function listFlavorsAndSizes() {
  const products = await getSafeCatalogProducts()
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
  const selection = resolveFlavorSelectionFromProducts(q, await getSafeCatalogProducts())
  return selection.kind === "matched" ? selection.product : undefined
}

export async function findExplicitFlavorSelection(query: string) {
  const selection = resolveFlavorSelectionFromProducts(query, await getSafeCatalogProducts())
  return selection.kind === "matched" ? selection.product : undefined
}

export async function resolveAvailableFlavorSelection(query: string) {
  return resolveFlavorSelectionFromProducts(query, await getSafeCatalogProducts())
}

export async function findFlavorFactsByQuery(q: string) {
  const product = await findProductBySlugOrFlavor(q)
  if (!product) return undefined
  return getCatalogFlavorFacts(product.category)
}

export async function isKnownFlavor(flavor: string) {
  const normalized = normalize(flavor)
  const flavors = getFlavorsFromProducts(await getSafeCatalogProducts())
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
  if (!stripNonFlavorTerms(query)) return undefined

  const availableFlavors = getFlavorsFromProducts(await getSafeCatalogProducts())
  const availableCategories = new Set(availableFlavors.map((flavor) => flavor.category))
  const [adminRecords, archivedRecords] = await Promise.all([
    getAdminCatalogFlavorRecords(),
    getArchivedCatalogFlavorRecords(),
  ])
  const unavailableRecords = [...adminRecords, ...archivedRecords].filter(
    (record) => !availableCategories.has(record.slug) && isSafeChatbotRecord(record)
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

  return `Ahora mismo ${safeFlavorLabelForReply(flavor)} no está disponible para nuevos pedidos. ${alternativeCopy}`
}
