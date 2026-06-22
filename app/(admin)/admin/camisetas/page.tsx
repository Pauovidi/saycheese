export const dynamic = "force-dynamic"
export const revalidate = 0

import { ShirtsAdmin } from "@/src/components/admin/drops/shirts-admin"
import { listDropOrders, listDropReservations } from "@/src/data/drops-store"

export default async function AdminCamisetasPage() {
  const [reservations, orders] = await Promise.all([listDropReservations(), listDropOrders()])

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">Camisetas</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Revisa preventas sin pago y pedidos de merchandising sin mezclar campos de tartas.
        </p>
      </div>

      <ShirtsAdmin initialReservations={reservations} initialOrders={orders} />
    </section>
  )
}
