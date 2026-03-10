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
  description?: string
  allergens?: string
  portionInfo?: string
  weightInfo?: string
  images: string[]
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
    name: "Clásica",
    slug: "cajita-clasica",
    format: "cajita",
    category: "clasica",
    priceText: "12 €",
    priceValue: 12,
    shortDescription: "Cajita de tarta de queso artesanal sabor clásica (400 g).",
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
    priceText: "12 €",
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
    priceText: "12 €",
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
    name: "Mango-Maracuyá",
    slug: "cajita-mango-maracuya",
    format: "cajita",
    category: "mango-maracuya",
    priceText: "12 €",
    priceValue: 12,
    shortDescription: "Cajita de tarta de queso artesanal sabor mango-maracuyá (400 g).",
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
    priceText: "12 €",
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
    priceText: "12 €",
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
    name: "Tiramisú",
    slug: "cajita-tiramisu",
    format: "cajita",
    category: "tiramisu",
    priceText: "12 €",
    priceValue: 12,
    shortDescription: "Cajita de tarta de queso artesanal sabor tiramisú (400 g).",
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
    shortDescription: "Tarta de queso artesanal sabor clásica.",
    description: "Elaborada con ingredientes de alta calidad, destaca por su textura suave y cremosa",
    allergens: "Leche, huevo, gluten",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor clásica.",
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
    shortDescription: "Tarta de queso artesanal sabor Lotus.",
    description: "Delicioso toque caramelizado de Lotus que la hace única",
    allergens: "Leche, huevo, gluten",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor Lotus.",
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
    shortDescription: "Tarta de queso artesanal sabor pistacho.",
    description: "Mezcla equilibrada de queso con pasta de pistacho 100%, logrando un sabor intenso y natural.",
    allergens: "Leche, huevo, gluten, frutos de cáscara (pistacho)",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor pistacho.",
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
    shortDescription: "Tarta de queso artesanal sabor gofio.",
    description: "Elaborada con gofio de un molino local, con un sabor auténtico y tradicional",
    allergens: "Leche, huevo, gluten (trigo)",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor gofio.",
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
    shortDescription: "Tarta de queso artesanal sabor mango-maracuyá.",
    description: "Tropical y ligera, con el contraste ideal entre el dulzor del mango y el toque ácido del maracuyá",
    allergens: "Leche, huevo, gluten",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor mango-maracuyá.",
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
    shortDescription: "Tarta de queso artesanal sabor Hippo.",
    description: "Con el inconfundible sabor a avellana y chocolate blanco que la hace irresistible",
    allergens: "Leche, huevo, gluten, frutos de cáscara (avellana)",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor Hippo.",
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
    shortDescription: "Tarta de queso artesanal sabor polvito uruguayo.",
    description: "Inspirada en el postre canario, con el dulce de leche y el suspiro de Moya como protagonistas",
    allergens: "Leche, huevo, gluten",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor polvito uruguayo.",
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
    shortDescription: "Tarta de queso artesanal sabor Nutella.",
    description: "Para los amantes del chocolate, su sabor inconfundible a Nutella lo hace adictivo",
    allergens: "Leche, huevo, gluten, frutos de cáscara (avellana), soja",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor Nutella.",
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
    shortDescription: "Tarta de queso artesanal sabor tiramisú.",
    fullDescription: "Tarta de queso artesanal formato grande. 10-12 raciones (1,7 kg). Sabor tiramisú.",
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
