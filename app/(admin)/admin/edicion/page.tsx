export const dynamic = "force-dynamic"
export const revalidate = 0

import { CakeCatalogEditor } from "@/src/components/admin/cake-catalog-editor"
import { getCatalogFlavorRecords } from "@/src/data/products-store"

export default async function EdicionPage() {
  const flavors = await getCatalogFlavorRecords()

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">Edición de tartas</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Desde aquí puedes crear, editar y borrar sabores del catálogo real que consume la web pública. Los cambios
          afectan a la home, al listado de productos y a las fichas individuales.
        </p>
      </div>

      <CakeCatalogEditor initialFlavors={flavors} />
    </section>
  )
}
