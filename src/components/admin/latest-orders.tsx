"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { cancelOrder, markOrderDone, reopenOrder } from "@/actions/orders"
import { getProductionEntryLine, resolveCanonicalFlavorLabel, type ProductionCatalogFlavor } from "@/lib/admin/production-presentation"
import { Button } from "@/components/ui/button"
import { CancelOrderDialog } from "@/src/components/admin/cancel-order-dialog"
import { MarkDoneDialog } from "@/src/components/admin/mark-done-dialog"

type OrderItem = {
  type: "cake" | "box"
  flavor: string
  qty: number
}

type LatestOrder = {
  id: string
  delivery_date: string
  customer_name: string | null
  customer_email: string | null
  phone: string | null
  status: string
  order_items: OrderItem[] | null
}

type LatestOrdersProps = {
  initialOrders: LatestOrder[]
  flavorCatalog: ProductionCatalogFlavor[]
}

function StatusBadge({ status }: { status: string }) {
  if (status === "done") {
    return <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">HECHO</span>
  }

  if (status === "cancelled") {
    return <span className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">ANULADO</span>
  }

  return <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">PENDIENTE</span>
}

export function LatestOrders({ initialOrders, flavorCatalog }: LatestOrdersProps) {
  const router = useRouter()
  const [orders, setOrders] = useState(initialOrders)
  const [, startTransition] = useTransition()

  function handleCancel(orderId: string, reason?: string) {
    startTransition(async () => {
      const response = await cancelOrder(orderId, reason)

      if (!response.ok) {
        toast.error(response.error ?? "No se pudo anular")
        return
      }

      setOrders((prev) => prev.filter((order) => order.id !== orderId))
      toast.success("Pedido anulado")
      router.refresh()
    })
  }

  function handleDone(orderId: string) {
    startTransition(async () => {
      const response = await markOrderDone(orderId)

      if (!response.ok) {
        toast.error(response.error ?? "No se pudo marcar como hecho")
        return
      }

      setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: "done" } : order)))
      toast.success("Pedido marcado como hecho")
      router.refresh()
    })
  }

  function handleReopen(orderId: string) {
    startTransition(async () => {
      const response = await reopenOrder(orderId)

      if (!response.ok) {
        toast.error(response.error ?? "No se pudo reabrir")
        return
      }

      setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: "pending" } : order)))
      toast.success("Pedido reabierto")
      router.refresh()
    })
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-4">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-foreground">
        Últimos pedidos
      </h2>

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay pedidos.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded border border-border p-3">
              <p className="text-sm font-semibold">
                Entrega: <span className="font-normal">{order.delivery_date}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {order.customer_name || "Sin nombre"} · {order.customer_email || "Sin email"} · {order.phone || "Sin teléfono"}
              </p>
              <div className="mt-2">
                <StatusBadge status={order.status} />
              </div>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {(order.order_items ?? []).map((item, idx) => (
                  <li key={`${order.id}-${idx}`}>
                    {getProductionEntryLine({
                      type: item.type,
                      flavor: resolveCanonicalFlavorLabel(item.flavor, flavorCatalog),
                      qty: item.qty,
                    })}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap gap-2">
                {order.status === "pending" ? <MarkDoneDialog orderId={order.id} onConfirm={handleDone} /> : null}
                {order.status === "done" ? (
                  <Button size="sm" variant="outline" onClick={() => handleReopen(order.id)}>
                    Reabrir
                  </Button>
                ) : null}
                {order.status !== "cancelled" ? <CancelOrderDialog orderId={order.id} onConfirm={handleCancel} /> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
