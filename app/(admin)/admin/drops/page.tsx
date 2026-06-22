export const dynamic = "force-dynamic"
export const revalidate = 0

import { DropAdminEditor } from "@/src/components/admin/drops/drop-admin-editor"
import { listAdminDrops } from "@/src/data/drops-store"

export default async function AdminDropsPage() {
  const drops = await listAdminDrops()

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">Drops</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Configura merchandising, fecha de lanzamiento, stock global y el flotante de preventa del hero.
        </p>
      </div>

      <DropAdminEditor initialDrops={drops} />
    </section>
  )
}
