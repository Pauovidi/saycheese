import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { products, getProductBySlug } from "@/src/data/products"
import { ProductDetail } from "@/src/components/product/product-detail"
import { RecommendedProducts } from "@/src/components/product/recommended-products"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = getProductBySlug(slug)
  if (!product) return { title: "Producto no encontrado" }
  return {
    title: `${product.name} (${product.format === "tarta" ? "Tarta" : "Cajita"}) | SayCheese`,
    description: product.shortDescription,
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = getProductBySlug(slug)
  if (!product) notFound()

  // Recommend same category (different format) + same format (different category)
  const recommended = products
    .filter((p) => p.id !== product.id && (p.category === product.category || p.format === product.format))
    .slice(0, 4)

  return (
    <>
      <ProductDetail product={product} />
      {recommended.length > 0 && <RecommendedProducts products={recommended} />}
    </>
  )
}
