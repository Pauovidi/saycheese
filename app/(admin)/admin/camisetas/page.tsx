export const dynamic = "force-dynamic"
export const revalidate = 0

import { ShirtsAdmin } from "@/src/components/admin/drops/shirts-admin"
import { listDropOrdersWithAvailability, listDropReservationsWithAvailability } from "@/src/data/drops-store"

export default async function AdminCamisetasPage() {
  const [reservationsState, ordersState] = await Promise.all([
    listDropReservationsWithAvailability(),
    listDropOrdersWithAvailability(),
  ])
  const moduleAvailability =
    reservationsState.availability === "READY" ? ordersState.availability : reservationsState.availability
  const moduleMessage = reservationsState.message ?? ordersState.message

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">Camisetas</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Revisa preventas sin pago y pedidos de merchandising sin mezclar campos de tartas.
        </p>
      </div>

      <ShirtsAdmin
        initialReservations={reservationsState.data}
        initialOrders={ordersState.data}
        moduleAvailability={moduleAvailability}
        moduleMessage={moduleMessage}
      />
    </section>
  )
}
