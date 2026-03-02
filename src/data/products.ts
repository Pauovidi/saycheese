export interface Product {
  id: string
  name: string
  slug: string
  format: "tarta" | "cajita"
  category: string
  priceText: string
  priceValue: number
  shortDescription: string
  fullDescription?: string
  portionInfo?: string
  weightInfo?: string
  images: string[]
  imagesSource?: string
  descriptionHtml?: string
  excerpt?: string
  legacyUrl?: string
  featured: boolean
}

/** A "flavor" groups both formats (tarta + cajita) under a shared category */
export type Flavor = {
  category: string
  label: string
  tarta?: Product
  cajita?: Product
}

export const products: Product[] = [
  // ── CAJITAS (400 g - 12 EUR) ──────────────────────────────────────────
  {
    id: "cajita-clasica",
    name: "Cl\u00e1sica",
    slug: "cajita-clasica",
    format: "cajita",
    category: "clasica",
    priceText: "12 \u20ac",
    priceValue: 12,
    shortDescription: "Cajita de tarta de queso artesanal sabor cl\u00e1sica (400 g).",
    fullDescription: "Formato cajita individual/compartir de 400 g. Sabor cl\u00e1sica.",
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
    priceText: "12 \u20ac",
    priceValue: 12,
    shortDescription: "Cajita de tarta de queso artesanal sabor Lotus (400 g).",
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
    priceText: "12 \u20ac",
    priceValue: 12,
    shortDescription: "Cajita de tarta de queso artesanal sabor pistacho (400 g).",
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
    priceText: "12 \u20ac",
    priceValue: 12,
    shortDescription: "Cajita de tarta de queso artesanal sabor gofio (400 g).",
    fullDescription: "Formato cajita individual/compartir de 400 g. Sabor gofio.",
    portionInfo: "Formato cajita",
    weightInfo: "400 g",
    images: ["/images/products/cajita-gofio.webp"],
    featured: false,
  },
  {
    id: "cajita-mango-maracuya",
    name: "Mango-Maracuy\u00e1",
    slug: "cajita-mango-maracuya",
    format: "cajita",
    category: "mango-maracuya",
    priceText: "12 \u20ac",
    priceValue: 12,
    shortDescription: "Cajita de tarta de queso artesanal sabor mango-maracuy\u00e1 (400 g).",
    fullDescription: "Formato cajita individual/compartir de 400 g. Sabor mango-maracuy\u00e1.",
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
    priceText: "12 \u20ac",
    priceValue: 12,
    shortDescription: "Cajita de tarta de queso artesanal sabor Hippo (400 g).",
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
    priceText: "12 \u20ac",
    priceValue: 12,
    shortDescription: "Cajita de tarta de queso artesanal sabor polvito uruguayo (400 g).",
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
    priceText: "12 \u20ac",
    priceValue: 12,
    shortDescription: "Cajita de tarta de queso artesanal sabor Nutella (400 g).",
    fullDescription: "Formato cajita individual/compartir de 400 g. Sabor Nutella.",
    portionInfo: "Formato cajita",
    weightInfo: "400 g",
    images: ["/images/products/cajita-nutella.webp"],
    featured: false,
  },

  {
    id: "cajita-tiramisu",
    name: "Tiramis\u00fa",
    slug: "cajita-tiramisu",
    format: "cajita",
    category: "tiramisu",
    priceText: "12 \u20ac",
    priceValue: 12,
    shortDescription: "Cajita de tarta de queso artesanal sabor tiramis\u00fa (400 g).",
    fullDescription: "Formato cajita individual/compartir de 400 g. Sabor tiramis\u00fa.",
    portionInfo: "Formato cajita",
    weightInfo: "400 g",
    images: ["/images/products/cajita-tiramisu.webp"],
    featured: false,
  },

  // ── TARTAS (10-12 raciones - 1.7 kg - 35 EUR) ─────────────────────────
  {
    id: "tarta-clasica",
    name: "Cl\u00e1sica",
    slug: "tarta-clasica",
    format: "tarta",
    category: "clasica",
    priceText: "35 \u20ac",
    priceValue: 35,
    shortDescription: "Tarta de queso artesanal sabor cl\u00e1sica.",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor cl\u00e1sica.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: ["/images/products/tarta-clasica.jpg"],
    featured: true,
  },
  {
    id: "tarta-lotus",
    name: "Lotus",
    slug: "tarta-lotus",
    format: "tarta",
    category: "lotus",
    priceText: "35 \u20ac",
    priceValue: 35,
    shortDescription: "Tarta de queso artesanal sabor Lotus.",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor Lotus.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: ["/images/products/tarta-lotus.jpg"],
    featured: true,
  },
  {
    id: "tarta-pistacho",
    name: "Pistacho",
    slug: "tarta-pistacho",
    format: "tarta",
    category: "pistacho",
    priceText: "35 \u20ac",
    priceValue: 35,
    shortDescription: "Tarta de queso artesanal sabor pistacho.",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor pistacho.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: ["/images/products/tarta-pistacho.jpg"],
    featured: true,
  },
  {
    id: "tarta-gofio",
    name: "Gofio",
    slug: "tarta-gofio",
    format: "tarta",
    category: "gofio",
    priceText: "35 \u20ac",
    priceValue: 35,
    shortDescription: "Tarta de queso artesanal sabor gofio.",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor gofio.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: ["/images/products/tarta-gofio.jpg"],
    featured: false,
  },
  {
    id: "tarta-mango-maracuya",
    name: "Mango-Maracuy\u00e1",
    slug: "tarta-mango-maracuya",
    format: "tarta",
    category: "mango-maracuya",
    priceText: "35 \u20ac",
    priceValue: 35,
    shortDescription: "Tarta de queso artesanal sabor mango-maracuy\u00e1.",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor mango-maracuy\u00e1.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: ["/images/products/tarta-mango-maracuya.jpg"],
    featured: false,
  },
  {
    id: "tarta-hippo",
    name: "Hippo",
    slug: "tarta-hippo",
    format: "tarta",
    category: "hippo",
    priceText: "35 \u20ac",
    priceValue: 35,
    shortDescription: "Tarta de queso artesanal sabor Hippo.",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor Hippo.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: ["/images/products/tarta-hippo.jpg"],
    featured: false,
  },

  {
    id: "tarta-polvito-uruguayo",
    name: "Polvito Uruguayo",
    slug: "tarta-polvito-uruguayo",
    format: "tarta",
    category: "polvito-uruguayo",
    priceText: "35 \u20ac",
    priceValue: 35,
    shortDescription: "Tarta de queso artesanal sabor polvito uruguayo.",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor polvito uruguayo.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: [],
    featured: false,
  },
  {
    id: "tarta-nutella",
    name: "Nutella",
    slug: "tarta-nutella",
    format: "tarta",
    category: "nutella",
    priceText: "35 \u20ac",
    priceValue: 35,
    shortDescription: "Tarta de queso artesanal sabor Nutella.",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor Nutella.",
    portionInfo: "10-12 raciones",
    weightInfo: "1,7 kg",
    images: [],
    featured: false,
  },
  {
    id: "tarta-tiramisu",
    name: "Tiramis\u00fa",
    slug: "tarta-tiramisu",
    format: "tarta",
    category: "tiramisu",
    priceText: "35 \u20ac",
    priceValue: 35,
    shortDescription: "Tarta de queso artesanal sabor tiramis\u00fa.",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor tiramis\u00fa.",
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
