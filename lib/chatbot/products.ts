import "server-only"

import { products, type Product } from "@/src/data/products"

const KNOWN_ALLERGENS = [
  "gluten",
  "lácteos",
  "lacteos",
  "huevo",
  "huevos",
  "frutos secos",
  "pistacho",
  "soja",
  "cacahuete",
  "almendra",
  "avellana",
  "nuez",
  "sésamo",
  "sesamo",
]

const KNOWN_INGREDIENTS = [
  "queso",
  "nata",
  "leche",
  "huevo",
  "harina",
  "mantequilla",
  "azúcar",
  "azucar",
  "chocolate",
  "lotus",
  "pistacho",
  "gofio",
  "mango",
  "maracuyá",
  "maracuya",
  "nutella",
  "cacao",
  "café",
  "cafe",
]

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function listFlavorsAndSizes() {
  const grouped = new Map<string, { flavor: string; sizes: { format: Product["format"]; label: string; priceText: string }[] }>()

  for (const product of products) {
    const key = product.category
    const current = grouped.get(key) ?? { flavor: product.name, sizes: [] }
    current.sizes.push({
      format: product.format,
      label: product.format === "tarta" ? "Tarta (1,7 kg · 10-12 raciones)" : "Cajita (400 g)",
      priceText: product.priceText,
    })
    grouped.set(key, current)
  }

  return Array.from(grouped.values()).map((row) => ({
    flavor: row.flavor,
    sizes: row.sizes.sort((a, b) => (a.format === "tarta" ? -1 : 1)),
  }))
}

export function findProductBySlugOrFlavor(q: string) {
  const query = normalize(q)
  return products.find((product) => {
    return [product.slug, product.name, product.category].some((candidate) => normalize(candidate).includes(query))
  })
}

export function extractAllergensAndIngredients(productDescription?: string) {
  if (!productDescription) {
    return { allergens: [] as string[], ingredients: [] as string[] }
  }

  const text = normalize(productDescription)

  const allergens = KNOWN_ALLERGENS.filter((item) => text.includes(normalize(item)))
  const ingredients = KNOWN_INGREDIENTS.filter((item) => text.includes(normalize(item)))

  return {
    allergens: Array.from(new Set(allergens)),
    ingredients: Array.from(new Set(ingredients)),
  }
}
