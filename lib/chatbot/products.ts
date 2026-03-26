import "server-only"

import { products, type Product } from "@/src/data/products"

const ALLERGEN_WORDS = ["gluten", "lacteos", "lácteos", "huevo", "huevos", "frutos secos", "soja", "sesamo", "sésamo"]
const INGREDIENT_WORDS = ["queso", "nata", "leche", "huevo", "harina", "mantequilla", "azucar", "azúcar", "chocolate", "pistacho", "lotus", "gofio", "mango", "maracuya", "maracuyá", "nutella", "cafe", "café"]
const ALLERGEN_FOCUS = [
  { label: "gluten", terms: ["gluten", "trigo"] },
  { label: "leche/lácteos", terms: ["lactosa", "lacteos", "lácteos", "leche"] },
  { label: "huevo", terms: ["huevo", "huevos"] },
  { label: "frutos secos", terms: ["frutos secos", "frutos de cascara", "frutos de cáscara", "avellana", "avellanas", "pistacho", "pistachos"] },
  { label: "soja", terms: ["soja"] },
] as const

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

function splitAllergens(value?: string) {
  if (!value) return []

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function getProductText(product: Product) {
  return [product.description, product.fullDescription, product.shortDescription].filter(Boolean).join(". ")
}

function getRequestedFormat(message: string) {
  const normalizedMessage = normalize(message)
  if (/\bcajita(s)?\b/.test(normalizedMessage)) return "cajita" as const
  if (/\btarta(s)?\b/.test(normalizedMessage)) return "tarta" as const
  return undefined
}

function findProductFromMessage(message: string) {
  const direct = findProductBySlugOrFlavor(message)
  if (direct) return direct

  const normalizedMessage = normalize(message)
  return products.find((product) => {
    return [product.slug, product.name, product.category].some((field) => normalizedMessage.includes(normalize(field)))
  })
}

function findAllergenSourceProduct(product: Product) {
  const sameFlavor = products.filter((candidate) => normalize(candidate.category) === normalize(product.category))

  return (
    sameFlavor.find((candidate) => candidate.id === product.id && candidate.allergens?.trim()) ??
    sameFlavor.find((candidate) => candidate.format === product.format && candidate.allergens?.trim()) ??
    sameFlavor.find((candidate) => candidate.format === "tarta" && candidate.allergens?.trim()) ??
    sameFlavor.find((candidate) => candidate.allergens?.trim())
  )
}

export function listFlavorsAndSizes() {
  const grouped = new Map<string, { flavor: string; sizes: { format: "tarta" | "cajita"; priceText: string }[] }>()

  for (const product of products) {
    const current = grouped.get(product.category) ?? { flavor: product.name, sizes: [] }
    current.sizes.push({ format: product.format, priceText: product.priceText })
    grouped.set(product.category, current)
  }

  return Array.from(grouped.values()).map((entry) => ({
    flavor: entry.flavor,
    sizes: entry.sizes.sort((a, b) => (a.format === "tarta" ? -1 : 1)),
  }))
}

export function findProductBySlugOrFlavor(q: string) {
  const query = normalize(q)
  return products.find((product) => [product.slug, product.name, product.category].some((field) => normalize(field).includes(query)))
}

export function extractAllergensAndIngredients(productDescription?: string) {
  if (!productDescription) {
    return { allergens: [] as string[], ingredients: [] as string[] }
  }

  const text = normalize(productDescription)
  const allergens = ALLERGEN_WORDS.filter((word) => text.includes(normalize(word)))
  const ingredients = INGREDIENT_WORDS.filter((word) => text.includes(normalize(word)))

  return {
    allergens: Array.from(new Set(allergens)),
    ingredients: Array.from(new Set(ingredients)),
  }
}

export function getProductFoodInfo(message: string) {
  const matchedProduct = findProductFromMessage(message)
  if (!matchedProduct) return undefined

  const sourceProduct = findAllergenSourceProduct(matchedProduct) ?? matchedProduct
  const detail = extractAllergensAndIngredients(getProductText(sourceProduct))

  return {
    matchedProduct,
    sourceProduct,
    allergens: splitAllergens(sourceProduct.allergens),
    ingredients: detail.ingredients,
    requestedFormat: getRequestedFormat(message),
  }
}

export function detectAllergenFocus(message: string) {
  const normalizedMessage = normalize(message)
  return ALLERGEN_FOCUS.find((focus) => focus.terms.some((term) => normalizedMessage.includes(normalize(term))))
}

export function productMatchesAllergenFocus(allergens: string[], terms: readonly string[]) {
  const normalizedAllergens = allergens.map((entry) => normalize(entry))
  return terms.some((term) => normalizedAllergens.some((entry) => entry.includes(normalize(term))))
}

export function listFlavorMatchesForAllergen(message: string) {
  const focus = detectAllergenFocus(message)
  if (!focus) return undefined

  const matches: { name: string; allergens: string[] }[] = []
  const missingInfo: string[] = []
  const seenCategories = new Set<string>()
  const requestedFormat = getRequestedFormat(message)

  for (const product of products) {
    if (requestedFormat && product.format !== requestedFormat) continue

    const categoryKey = normalize(product.category)
    if (seenCategories.has(categoryKey)) continue
    seenCategories.add(categoryKey)

    const sourceProduct = findAllergenSourceProduct(product)
    if (!sourceProduct?.allergens) {
      missingInfo.push(product.name)
      continue
    }

    const allergens = splitAllergens(sourceProduct.allergens)
    if (productMatchesAllergenFocus(allergens, focus.terms)) {
      matches.push({ name: sourceProduct.name, allergens })
    }
  }

  return {
    label: focus.label,
    matches,
    missingInfo,
    requestedFormat,
  }
}

export function isKnownFlavor(flavor: string) {
  const normalized = normalize(flavor)
  return products.some((product) => normalize(product.category) === normalized || normalize(product.name) === normalized)
}
