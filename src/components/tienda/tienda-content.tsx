import type { Flavor } from "@/src/data/products"
import { ProductCard } from "@/src/components/product-card"

interface TiendaContentProps {
  flavors: Flavor[]
}

export function TiendaContent({ flavors }: TiendaContentProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-10 lg:grid-cols-3">
      {flavors.map((flavor) => {
        // Show the cajita version by default; fall back to tarta if no cajita exists
        const primaryProduct = flavor.cajita ?? flavor.tarta
        const sibling = primaryProduct?.format === "tarta" ? flavor.cajita : flavor.tarta
        if (!primaryProduct) return null
        return (
          <ProductCard key={flavor.category} product={primaryProduct} sibling={sibling} />
        )
      })}
    </div>
  )
}
