import "server-only"

import { getCustomerFacingFormatLabel } from "@/src/data/business"
import { getFlavorFacts, getFlavors, getProductBySlug, getProductsByCategory, products, type Product } from "@/src/data/products"

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

function detectRequestedFormat(query: string): Product["format"] | undefined {
  const normalized = normalize(query)
  if (/\bcajita\b/.test(normalized)) return "cajita"
  if (/\b(tarta|grande)\b/.test(normalized)) return "tarta"
  return undefined
}

function scoreFlavorMatch(query: string, product: Product) {
  const normalizedQuery = normalize(query)
  const fields = [product.slug, product.name, product.category].map(normalize)
  const haystack = fields.join(" ")

  if (fields.includes(normalizedQuery)) return 100
  if (fields.some((field) => normalizedQuery.includes(field))) return 80
  if (fields.some((field) => field.includes(normalizedQuery))) return 70

  const tokens = normalizedQuery.split(/\s+/).filter((token) => token.length >= 3)
  if (tokens.length && tokens.every((token) => haystack.includes(token))) {
    return 60
  }

  return 0
}

export function listFlavorsAndSizes() {
  const grouped = new Map<string, { flavor: string; sizes: { format: "tarta" | "cajita"; label: string; priceText: string }[] }>()

  for (const product of products) {
    const current = grouped.get(product.category) ?? { flavor: product.name, sizes: [] }
    current.sizes.push({
      format: product.format,
      label: getCustomerFacingFormatLabel(product.format),
      priceText: product.priceText,
    })
    grouped.set(product.category, current)
  }

  return Array.from(grouped.values()).map((entry) => ({
    flavor: entry.flavor,
    sizes: entry.sizes.sort((a, b) => (a.format === "tarta" ? -1 : 1)),
  }))
}

export function findProductBySlugOrFlavor(q: string) {
  const exactSlug = getProductBySlug(q)
  if (exactSlug) return exactSlug

  const requestedFormat = detectRequestedFormat(q)
  const bestProduct = products
    .map((product) => ({ product, score: scoreFlavorMatch(q, product) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || Number(Boolean(b.product.allergens)) - Number(Boolean(a.product.allergens)))[0]?.product

  if (!bestProduct) return undefined
  if (requestedFormat) {
    return getProductsByCategory(bestProduct.category).find((product) => product.format === requestedFormat) ?? bestProduct
  }

  return getProductsByCategory(bestProduct.category).find((product) => Boolean(product.allergens)) ?? bestProduct
}

export function findFlavorFactsByQuery(q: string) {
  const product = findProductBySlugOrFlavor(q)
  if (!product) return undefined
  return getFlavorFacts(product.category)
}

export function isKnownFlavor(flavor: string) {
  const normalized = normalize(flavor)
  return getFlavors().some((flavorEntry) => normalize(flavorEntry.category) === normalized || normalize(flavorEntry.label) === normalized)
}
