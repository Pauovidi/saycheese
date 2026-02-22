"use client"

import type { Product } from "@/src/data/products"
import { ProductCard } from "@/src/components/product-card"

interface RecommendedProductsProps {
  products: Product[]
}

export function RecommendedProducts({ products }: RecommendedProductsProps) {
  return (
    <section className="border-t border-border py-16 md:py-20">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
        <h2 className="mb-10 text-center text-xs font-bold uppercase tracking-[0.3em] text-foreground">
          {"Tambi\u00e9n te puede gustar"}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:gap-10 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}
