"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { cancelOrder, markOrderDone, reopenOrder, searchOrders } from "@/actions/orders"
import { getProductionEntryLine, resolveCanonicalFlavorLabel, type ProductionCatalogFlavor } from "@/lib/admin/production-presentation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CancelOrderDialog } from "@/src/components/admin/cancel-order-dialog"
import { MarkDoneDialog } from "@/src/components/admin/mark-done-dialog"

type OrderItem = {
  type: "cake" | "box"
  flavor: string
  qty: number
}

type OrderResult = {
  id: string
  delivery_date: string
  customer_name: string | null
  customer_email: string | null
  phone: string | null
  status: string
  cancelled_at?: string | null
  order_items: OrderItem[] | null
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

export function AdminOrderSearch({ flavorCatalog }: { flavorCatalog: ProductionCatalogFlavor[] }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [results, setResults] = useState<OrderResult[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSearch() {
    setErrorMessage(null)

    startTransition(async () => {
      const response = await searchOrders(searchQuery)

      if (!response.ok) {
        setResults([])
        setErrorMessage(response.error ?? "No se pudo completar la búsqueda")
        return
      }

      setResults((response.results as OrderResult[]) ?? [])
    })
  }

  function handleCancel(orderId: string, reason?: string) {
    startTransition(async () => {
      const response = await cancelOrder(orderId, reason)

      if (!response.ok) {
        toast.error(response.error ?? "No se pudo anular")
        return
      }

      setResults((prev) => prev.filter((order) => order.id !== orderId))
      toast.success("Pedido anulado")
    })
  }

  function handleDone(orderId: string) {
    startTransition(async () => {
      const response = await markOrderDone(orderId)

      if (!response.ok) {
        toast.error(response.error ?? "No se pudo marcar como hecho")
        return
      }

      setResults((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: "done" } : order)))
      toast.success("Pedido marcado como hecho")
    })
  }

  function handleReopen(orderId: string) {
    startTransition(async () => {
      const response = await reopenOrder(orderId)

      if (!response.ok) {
        toast.error(response.error ?? "No se pudo reabrir")
        return
      }

      setResults((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: "pending" } : order)))
      toast.success("Pedido reabierto")
    })
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-4">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-foreground">
        Buscar pedido
      </h2>

      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <Input
          placeholder="Buscar por nombre, teléfono o sabor"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <Button onClick={handleSearch} disabled={isPending}>
          Buscar
        </Button>
      </div>

      {errorMessage ? <p className="mb-3 text-sm text-red-600">{errorMessage}</p> : null}

      {!errorMessage && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay resultados.</p>
      ) : (
        <div className="space-y-4">
          {results.map((order) => (
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
