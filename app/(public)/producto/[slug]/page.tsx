export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCustomerFacingFormatLabel } from "@/src/data/business"
import { getSiblingFromProducts } from "@/src/data/products"
import { getCatalogProductBySlug, getCatalogProducts } from "@/src/data/products-store"
import { ProductDetail } from "@/src/components/product/product-detail"
import { RecommendedProducts } from "@/src/components/product/recommended-products"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getCatalogProductBySlug(slug)
  if (!product) return { title: "Producto no encontrado" }
  return {
    title: `${product.name} (${getCustomerFacingFormatLabel(product.format)}) | SayCheese`,
    description: product.shortDescription,
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const products = await getCatalogProducts()
  const product = products.find((entry) => entry.slug === slug)
  if (!product) notFound()
  const sibling = getSiblingFromProducts(products, product)

  // Recommend same category (different format) + same format (different category)
  const recommended = products
    .filter((p) => p.id !== product.id && (p.category === product.category || p.format === product.format))
    .slice(0, 4)

  return (
    <>
      <ProductDetail product={product} sibling={sibling} />
      {recommended.length > 0 && <RecommendedProducts products={recommended} catalogProducts={products} />}
    </>
  )
}
