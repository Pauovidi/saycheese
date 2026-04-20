import Link from "next/link"
import type { Flavor } from "@/src/data/products"
import { ProductCard } from "@/src/components/product-card"

interface FeaturedProductsProps {
  flavors: Flavor[]
}

export function FeaturedProducts({ flavors }: FeaturedProductsProps) {
  return (
    <section id="nuestros-sabores" className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
        <h2 className="text-center text-2xl font-bold uppercase tracking-[0.15em] text-foreground md:text-3xl lg:text-4xl text-balance">
          Nuestros sabores
        </h2>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-10 lg:grid-cols-3">
          {flavors.slice(0, 6).map((flavor, i) => {
            const product = flavor.cajita ?? flavor.tarta
            if (!product) return null
            const sibling = product.format === "tarta" ? flavor.cajita : flavor.tarta

            return <ProductCard key={flavor.category} product={product} sibling={sibling} priority={i < 3} />
          })}
        </div>
        <div className="mt-14 flex justify-center">
          <Link
            href="/productos"
            className="border border-primary px-8 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Ver todos los productos
          </Link>
        </div>
      </div>
    </section>
  )
}
