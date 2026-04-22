import type { Metadata } from "next"
import { TiendaContent } from "@/src/components/tienda/tienda-content"
import { getCatalogFlavors } from "@/src/data/products-store"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Productos | SayCheese",
  description: "Descubre todas nuestras tartas de queso artesanas. Cajitas y tartas completas.",
}

export default async function TiendaPage() {
  const flavors = await getCatalogFlavors()

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
        <h1 className="mb-12 text-center text-3xl font-bold uppercase tracking-[0.15em] text-foreground md:text-4xl">
          Nuestros productos
        </h1>
        <TiendaContent flavors={flavors} />
      </div>
    </section>
  )
}
