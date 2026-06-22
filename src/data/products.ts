export interface Product {
  id: string
  name: string
  slug: string
  format: "tarta" | "cajita" | "drop"
  category: string
  priceText: string
  priceValue: number
  shortDescription: string
  fullDescription?: string
  description?: string
  allergens?: string
  ingredients?: string[]
  portionInfo?: string
  weightInfo?: string
  images: string[]
  featured: boolean
  isMonthlySpecial?: boolean
  isMonthlySpecialActive?: boolean
  monthlySpecialExpiresAt?: string | null
  dropId?: string
  selectedSize?: string
  selectedColor?: string
  stockAvailable?: number
}

/** A "flavor" groups both formats (tarta + cajita) under a shared category */
export type Flavor = {
  category: string
  label: string
  tarta?: Product
  cajita?: Product
  isMonthlySpecial?: boolean
  isMonthlySpecialActive?: boolean
  monthlySpecialExpiresAt?: string | null
}

export type MonthlySpecialFields = {
  isMonthlySpecial?: boolean
  monthlySpecialExpiresAt?: string | null
}

function timestampFromOptionalDate(value?: string | null) {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function isMonthlySpecialActive(input: MonthlySpecialFields, at: Date = new Date()) {
  if (!input.isMonthlySpecial) return false
  const expiresAt = timestampFromOptionalDate(input.monthlySpecialExpiresAt)
  if (expiresAt === null) return false
  return expiresAt > at.getTime()
}

export function isCakeFlavorAvailable(input: MonthlySpecialFields & { deletedAt?: string | null }, at: Date = new Date()) {
  if (input.deletedAt) return false
  if (input.isMonthlySpecial && !isMonthlySpecialActive(input, at)) return false
  return true
}

export function getCakeFlavorAdminStatus(input: MonthlySpecialFields & { deletedAt?: string | null }, at: Date = new Date()) {
  if (input.deletedAt) return "despublicada"
  if (isMonthlySpecialActive(input, at)) return "tarta del mes activa"
  if (input.isMonthlySpecial) return "tarta del mes expirada"
  return "publicada"
}

export const products: Product[] = [
  // ── CAJITAS (400 g - 12 EUR) ──────────────────────────────────────────
  {
    id: "cajita-clasica",
    name: "Clásica",
    slug: "cajita-clasica",
    format: "cajita",
    category: "clasica",
    priceText: "12 €",
    priceValue: 12,
    shortDescription: "Cajita de cheesecake artesanal sabor clásica (400 g).",
    fullDescription: "Formato cajita individual/compartir de 400 g. Sabor clásica.",
    portionInfo: "Formato cajita",
    weightInfo: "400 g",
    images: ["/images/products/cajita-clasica.webp"],
    featured: true,
  },
  {
    id: "cajita-lotus",
    name: "Lotus",
    slug: "cajita-lotus",
    format: "cajita",
    category: "lotus",
    priceText: "12 €",
    priceValue: 12,
    shortDescription: "Cajita de cheesecake artesanal sabor Lotus (400 g).",
    fullDescription: "Formato cajita individual/compartir de 400 g. Sabor Lotus.",
    portionInfo: "Formato cajita",
    weightInfo: "400 g",
    images: ["/images/products/cajita-lotus.webp"],
    featured: true,
  },
  {
    id: "cajita-pistacho",
    name: "Pistacho",
    slug: "cajita-pistacho",
    format: "cajita",
    category: "pistacho",
    priceText: "12 €",
    priceValue: 12,
    shortDescription: "Cajita de cheesecake artesanal sabor pistacho (400 g).",
    fullDescription: "Formato cajita individual/compartir de 400 g. Sabor pistacho.",
    portionInfo: "Formato cajita",
    weightInfo: "400 g",
    images: ["/images/products/cajita-pistacho.webp"],
    featured: true,
  },
  {
    id: "cajita-gofio",
    name: "Gofio",
    slug: "cajita-gofio",
    format: "cajita",
    category: "gofio",
    priceText: "12 €",
    priceValue: 12,
    shortDescription: "Cajita de cheesecake artesanal sabor gofio (400 g).",
    fullDescription: "Formato cajita individual/compartir de 400 g. Sabor gofio.",
    portionInfo: "Formato cajita",
    weightInfo: "400 g",
    images: ["/images/products/cajita-gofio.webp"],
    featured: false,
  },
  {
    id: "cajita-mango-maracuya",
    name: "Mango-Maracuyá",
    slug: "cajita-mango-maracuya",
    format: "cajita",
    category: "mango-maracuya",
    priceText: "12 €",
    priceValue: 12,
    shortDescription: "Cajita de cheesecake artesanal sabor mango-maracuyá (400 g).",
    fullDescription: "Formato cajita individual/compartir de 400 g. Sabor mango-maracuyá.",
    portionInfo: "Formato cajita",
    weightInfo: "400 g",
    images: ["/images/products/cajita-mango-maracuya.webp"],
    featured: false,
  },
  {
    id: "cajita-hippo",
    name: "Hippo",
    slug: "cajita-hippo",
    format: "cajita",
    category: "hippo",
    priceText: "12 €",
    priceValue: 12,
    shortDescription: "Cajita de cheesecake artesanal sabor Hippo (400 g).",
    fullDescription: "Formato cajita individual/compartir de 400 g. Sabor Hippo.",
    portionInfo: "Formato cajita",
    weightInfo: "400 g",
    images: ["/images/products/cajita-hippo.webp"],
    featured: false,
  },
  {
    id: "cajita-polvito-uruguayo",
    name: "Polvito Uruguayo",
    slug: "cajita-polvito-uruguayo",
    format: "cajita",
    category: "polvito-uruguayo",
    priceText: "12 €",
    priceValue: 12,
    shortDescription: "Cajita de cheesecake artesanal sabor polvito uruguayo (400 g).",
    fullDescription: "Formato cajita individual/compartir de 400 g. Sabor polvito uruguayo.",
    portionInfo: "Formato cajita",
    weightInfo: "400 g",
    images: ["/images/products/cajita-polvito-uruguayo.webp"],
    featured: false,
  },
  {
    id: "cajita-nutella",
    name: "Nutella",
    slug: "cajita-nutella",
    format: "cajita",
    category: "nutella",
    priceText: "12 €",
    priceValue: 12,
    shortDescription: "Cajita de cheesecake artesanal sabor Nutella (400 g).",
    fullDescription: "Formato cajita individual/compartir de 400 g. Sabor Nutella.",
    portionInfo: "Formato cajita",
    weightInfo: "400 g",
    images: ["/images/products/cajita-nutella.webp"],
    featured: false,
  },

  {
    id: "cajita-tiramisu",
    name: "Tiramisú",
    slug: "cajita-tiramisu",
    format: "cajita",
    category: "tiramisu",
    priceText: "12 €",
    priceValue: 12,
    shortDescription: "Cajita de cheesecake artesanal sabor tiramisú (400 g).",
    fullDescription: "Formato cajita individual/compartir de 400 g. Sabor tiramisú.",
    portionInfo: "Formato cajita",
    weightInfo: "400 g",
    images: ["/images/products/cajita-tiramisu.webp"],
    featured: false,
  },

  // ── TARTAS (10-12 raciones - 1.7 kg - 35 EUR) ─────────────────────────
  {
    id: "tarta-clasica",
    name: "Clásica",
    slug: "tarta-clasica",
    format: "tarta",
    category: "clasica",
    priceText: "35 €",
    priceValue: 35,
    shortDescription: "Formato grande de cheesecake artesanal sabor clásica.",
    description: "Elaborada con ingredientes de alta calidad, destaca por su textura suave y cremosa",
    allergens: "Leche, huevo, gluten",
    fullDescription: "Formato grande de cheesecake artesanal. 10-12 raciones (1,7 kg). Sabor clásica.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: ["/images/products/tarta-clasica.webp"],
    featured: true,
  },
  {
    id: "tarta-lotus",
    name: "Lotus",
    slug: "tarta-lotus",
    format: "tarta",
    category: "lotus",
    priceText: "35 €",
    priceValue: 35,
    shortDescription: "Formato grande de cheesecake artesanal sabor Lotus.",
    description: "Delicioso toque caramelizado de Lotus que la hace única",
    allergens: "Leche, huevo, gluten",
    fullDescription: "Formato grande de cheesecake artesanal. 10-12 raciones (1,7 kg). Sabor Lotus.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: ["/images/products/tarta-lotus.webp"],
    featured: true,
  },
  {
    id: "tarta-pistacho",
    name: "Pistacho",
    slug: "tarta-pistacho",
    format: "tarta",
    category: "pistacho",
    priceText: "35 €",
    priceValue: 35,
    shortDescription: "Formato grande de cheesecake artesanal sabor pistacho.",
    description: "Mezcla equilibrada de queso con pasta de pistacho 100%, logrando un sabor intenso y natural.",
    allergens: "Leche, huevo, gluten, frutos de cáscara (pistacho)",
    fullDescription: "Formato grande de cheesecake artesanal. 10-12 raciones (1,7 kg). Sabor pistacho.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: ["/images/products/tarta-pistacho.webp"],
    featured: true,
  },
  {
    id: "tarta-gofio",
    name: "Gofio",
    slug: "tarta-gofio",
    format: "tarta",
    category: "gofio",
    priceText: "35 €",
    priceValue: 35,
    shortDescription: "Formato grande de cheesecake artesanal sabor gofio.",
    description: "Elaborada con gofio de un molino local, con un sabor auténtico y tradicional",
    allergens: "Leche, huevo, gluten (trigo)",
    fullDescription: "Formato grande de cheesecake artesanal. 10-12 raciones (1,7 kg). Sabor gofio.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: ["/images/products/tarta-gofio.webp"],
    featured: false,
  },
  {
    id: "tarta-mango-maracuya",
    name: "Mango-Maracuyá",
    slug: "tarta-mango-maracuya",
    format: "tarta",
    category: "mango-maracuya",
    priceText: "35 €",
    priceValue: 35,
    shortDescription: "Formato grande de cheesecake artesanal sabor mango-maracuyá.",
    description: "Tropical y ligera, con el contraste ideal entre el dulzor del mango y el toque ácido del maracuyá",
    allergens: "Leche, huevo, gluten",
    fullDescription: "Formato grande de cheesecake artesanal. 10-12 raciones (1,7 kg). Sabor mango-maracuyá.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: ["/images/products/tarta-mango.webp"],
    featured: false,
  },
  {
    id: "tarta-hippo",
    name: "Hippo",
    slug: "tarta-hippo",
    format: "tarta",
    category: "hippo",
    priceText: "35 €",
    priceValue: 35,
    shortDescription: "Formato grande de cheesecake artesanal sabor Hippo.",
    description: "Con el inconfundible sabor a avellana y chocolate blanco que la hace irresistible",
    allergens: "Leche, huevo, gluten, frutos de cáscara (avellana)",
    fullDescription: "Formato grande de cheesecake artesanal. 10-12 raciones (1,7 kg). Sabor Hippo.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: ["/images/products/tarta-hippo.webp"],
    featured: false,
  },

  {
    id: "tarta-polvito-uruguayo",
    name: "Polvito Uruguayo",
    slug: "tarta-polvito-uruguayo",
    format: "tarta",
    category: "polvito-uruguayo",
    priceText: "35 €",
    priceValue: 35,
    shortDescription: "Formato grande de cheesecake artesanal sabor polvito uruguayo.",
    description: "Inspirada en el postre canario, con el dulce de leche y el suspiro de Moya como protagonistas",
    allergens: "Leche, huevo, gluten",
    fullDescription: "Formato grande de cheesecake artesanal. 10-12 raciones (1,7 kg). Sabor polvito uruguayo.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: ["/images/products/tarta-polvito.webp"],
    featured: false,
  },
  {
    id: "tarta-nutella",
    name: "Nutella",
    slug: "tarta-nutella",
    format: "tarta",
    category: "nutella",
    priceText: "35 €",
    priceValue: 35,
    shortDescription: "Formato grande de cheesecake artesanal sabor Nutella.",
    description: "Para los amantes del chocolate, su sabor inconfundible a Nutella lo hace adictivo",
    allergens: "Leche, huevo, gluten, frutos de cáscara (avellana), soja",
    fullDescription: "Formato grande de cheesecake artesanal. 10-12 raciones (1,7 kg). Sabor Nutella.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: ["/images/products/tarta-nutella.webp"],
    featured: false,
  },
  {
    id: "tarta-tiramisu",
    name: "Tiramisú",
    slug: "tarta-tiramisu",
    format: "tarta",
    category: "tiramisu",
    priceText: "35 €",
    priceValue: 35,
    shortDescription: "Formato grande de cheesecake artesanal sabor tiramisú.",
    fullDescription: "Formato grande de cheesecake artesanal. 10-12 raciones (1,7 kg). Sabor tiramisú.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: [],
    featured: false,
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug)
}

export function getProductsByCategory(category: string): Product[] {
  return products.filter((product) => product.category === category)
}

export function getFeaturedProducts(): Product[] {
  return products.filter((p) => p.featured)
}

export function getProductsByFormat(format: string): Product[] {
  if (format === "todos") return products
  return products.filter((p) => p.format === format)
}

/** Build a map of flavors, grouping tarta + cajita under a shared category */
export function getFlavors(): Flavor[] {
  const map = new Map<string, Flavor>()
  for (const p of products) {
    if (!map.has(p.category)) {
      map.set(p.category, { category: p.category, label: p.name })
    }
    const f = map.get(p.category)!
    if (p.format === "tarta") f.tarta = p
    else f.cajita = p
  }
  return Array.from(map.values())
}

/** Get the sibling product (tarta <-> cajita) for the same flavor */
export function getSibling(product: Product): Product | undefined {
  const otherFormat = product.format === "tarta" ? "cajita" : "tarta"
  return products.find(
    (p) => p.category === product.category && p.format === otherFormat
  )
}

/** Get categories (unique labels) */
export function getCategories(): string[] {
  return Array.from(new Set(products.map((p) => p.category)))
}

export function parseProductList(value?: string) {
  return value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) ?? []
}

export function getFlavorFacts(category: string) {
  const flavorProducts = getProductsByCategory(category)
  if (!flavorProducts.length) return null

  return {
    category,
    label: flavorProducts[0].name,
    allergens: Array.from(new Set(flavorProducts.flatMap((product) => parseProductList(product.allergens)))),
    ingredients: Array.from(new Set(flavorProducts.flatMap((product) => product.ingredients ?? []))),
    sourceProduct: flavorProducts.find((product) => parseProductList(product.allergens).length || (product.ingredients?.length ?? 0) > 0) ?? flavorProducts[0],
  }
}

export interface EditableFlavorRecord {
  slug: string
  name: string
  description: string
  allergens: string
  tartaImage: string
  cajitaImage: string
  tartaPrice: number
  cajitaPrice: number
  position: number
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
  isMonthlySpecial?: boolean
  monthlySpecialExpiresAt?: string | null
}

export interface EditableCatalogDocument {
  version: 1
  updatedAt: string
  flavors: EditableFlavorRecord[]
}

const TARTA_WEIGHT_INFO = "1,7 kg"
const TARTA_PORTION_INFO = "10-12 raciones"
const CAJITA_WEIGHT_INFO = "400 g"
const CAJITA_PORTION_INFO = "Formato cajita"

function formatPriceText(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value).replace(/\u00A0/g, " ")
}

export function slugifyFlavorName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function buildFlavorRecordsFromProducts(sourceProducts: Product[] = products): EditableFlavorRecord[] {
  return getFlavorsFromProducts(sourceProducts).map((flavor, index) => {
    const sourceProduct = flavor.tarta ?? flavor.cajita

    return {
      slug: flavor.category,
      name: sourceProduct?.name ?? flavor.label,
      description: flavor.tarta?.description ?? flavor.cajita?.description ?? "",
      allergens: flavor.tarta?.allergens ?? flavor.cajita?.allergens ?? "",
      tartaImage: flavor.tarta?.images[0] ?? "",
      cajitaImage: flavor.cajita?.images[0] ?? "",
      tartaPrice: flavor.tarta?.priceValue ?? 35,
      cajitaPrice: flavor.cajita?.priceValue ?? 12,
      position: index,
    }
  })
}

export const seedFlavorRecords = buildFlavorRecordsFromProducts(products)

export function buildProductsFromFlavorRecords(records: EditableFlavorRecord[]): Product[] {
  return sortFlavorRecords(records).flatMap((record, index) => {
    const category = record.slug
    const isSpecialActive = isMonthlySpecialActive(record)
    const specialFields = {
      isMonthlySpecial: Boolean(record.isMonthlySpecial),
      isMonthlySpecialActive: isSpecialActive,
      monthlySpecialExpiresAt: record.monthlySpecialExpiresAt ?? null,
    }
    const tarta: Product = {
      id: `tarta-${category}`,
      name: record.name,
      slug: `tarta-${category}`,
      format: "tarta",
      category,
      priceText: formatPriceText(record.tartaPrice),
      priceValue: record.tartaPrice,
      shortDescription: `Formato grande de cheesecake artesanal sabor ${record.name}.`,
      fullDescription: `Formato grande de cheesecake artesanal. ${TARTA_PORTION_INFO} (${TARTA_WEIGHT_INFO}). Sabor ${record.name}.`,
      description: record.description || undefined,
      allergens: record.allergens || undefined,
      portionInfo: TARTA_PORTION_INFO,
      weightInfo: TARTA_WEIGHT_INFO,
      images: record.tartaImage ? [record.tartaImage] : [],
      featured: isSpecialActive || index < 6,
      ...specialFields,
    }

    const cajita: Product = {
      id: `cajita-${category}`,
      name: record.name,
      slug: `cajita-${category}`,
      format: "cajita",
      category,
      priceText: formatPriceText(record.cajitaPrice),
      priceValue: record.cajitaPrice,
      shortDescription: `Cajita de cheesecake artesanal sabor ${record.name} (${CAJITA_WEIGHT_INFO}).`,
      fullDescription: `Formato cajita individual/compartir de ${CAJITA_WEIGHT_INFO}. Sabor ${record.name}.`,
      description: record.description || undefined,
      allergens: record.allergens || undefined,
      portionInfo: CAJITA_PORTION_INFO,
      weightInfo: CAJITA_WEIGHT_INFO,
      images: record.cajitaImage ? [record.cajitaImage] : [],
      featured: isSpecialActive || index < 6,
      ...specialFields,
    }

    return [cajita, tarta]
  })
}

export function sortFlavorRecords(records: EditableFlavorRecord[], at: Date = new Date()) {
  return [...records].sort((a, b) => {
    const specialDelta = Number(isMonthlySpecialActive(b, at)) - Number(isMonthlySpecialActive(a, at))
    if (specialDelta) return specialDelta
    return a.position - b.position || a.name.localeCompare(b.name, "es")
  })
}

export function filterAvailableFlavorRecords(records: EditableFlavorRecord[], at: Date = new Date()) {
  return sortFlavorRecords(
    records.filter((record) => isCakeFlavorAvailable(record, at)),
    at
  )
}

export function getFlavorsFromProducts(sourceProducts: Product[]): Flavor[] {
  const map = new Map<string, Flavor>()

  for (const product of sourceProducts) {
    if (!map.has(product.category)) {
      map.set(product.category, {
        category: product.category,
        label: product.name,
        isMonthlySpecial: product.isMonthlySpecial,
        isMonthlySpecialActive: product.isMonthlySpecialActive,
        monthlySpecialExpiresAt: product.monthlySpecialExpiresAt,
      })
    }

    const flavor = map.get(product.category)
    if (!flavor) continue

    flavor.isMonthlySpecial = flavor.isMonthlySpecial || product.isMonthlySpecial
    flavor.isMonthlySpecialActive = flavor.isMonthlySpecialActive || product.isMonthlySpecialActive
    flavor.monthlySpecialExpiresAt = flavor.monthlySpecialExpiresAt ?? product.monthlySpecialExpiresAt

    if (product.format === "tarta") {
      flavor.tarta = product
    } else {
      flavor.cajita = product
    }
  }

  return Array.from(map.values())
}

export function getProductBySlugFromProducts(sourceProducts: Product[], slug: string) {
  return sourceProducts.find((product) => product.slug === slug)
}

export function getProductsByCategoryFromProducts(sourceProducts: Product[], category: string) {
  return sourceProducts.filter((product) => product.category === category)
}

export function getSiblingFromProducts(sourceProducts: Product[], product: Product) {
  const otherFormat = product.format === "tarta" ? "cajita" : "tarta"
  return sourceProducts.find(
    (candidate) => candidate.category === product.category && candidate.format === otherFormat
  )
}

export function getFlavorFactsFromProducts(sourceProducts: Product[], category: string) {
  const flavorProducts = getProductsByCategoryFromProducts(sourceProducts, category)
  if (!flavorProducts.length) return null

  return {
    category,
    label: flavorProducts[0].name,
    allergens: Array.from(new Set(flavorProducts.flatMap((product) => parseProductList(product.allergens)))),
    ingredients: Array.from(new Set(flavorProducts.flatMap((product) => product.ingredients ?? []))),
    sourceProduct:
      flavorProducts.find(
        (product) => parseProductList(product.allergens).length || (product.ingredients?.length ?? 0) > 0
      ) ?? flavorProducts[0],
  }
}
