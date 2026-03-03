import "server-only"

import { products } from "@/src/data/products"

const ALLERGEN_WORDS = ["gluten", "lacteos", "lácteos", "huevo", "huevos", "frutos secos", "soja", "sesamo", "sésamo"]
const INGREDIENT_WORDS = ["queso", "nata", "leche", "huevo", "harina", "mantequilla", "azucar", "azúcar", "chocolate", "pistacho", "lotus", "gofio", "mango", "maracuya", "maracuyá", "nutella", "cafe", "café"]

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
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

export function isKnownFlavor(flavor: string) {
  const normalized = normalize(flavor)
  return products.some((product) => normalize(product.category) === normalized || normalize(product.name) === normalized)
}
