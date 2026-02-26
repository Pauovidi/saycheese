"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { cancelOrder, searchOrdersByPhone } from "@/actions/orders"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

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
  order_items: OrderItem[] | null
}

export function AdminOrderSearch() {
  const [phoneQuery, setPhoneQuery] = useState("")
  const [results, setResults] = useState<OrderResult[]>([])
  const [reasonByOrder, setReasonByOrder] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function handleSearch() {
    if (!phoneQuery.trim()) {
      toast.error("Introduce un teléfono para buscar")
      return
    }

    startTransition(async () => {
      try {
        const data = (await searchOrdersByPhone(phoneQuery, false)) as OrderResult[]
        setResults(data)
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo buscar"
        toast.error(message)
      }
    })
  }

  function handleCancel(orderId: string) {
    startTransition(async () => {
      try {
        await cancelOrder(orderId, reasonByOrder[orderId])
        setResults((prev) => prev.filter((order) => order.id !== orderId))
        toast.success("Pedido anulado")
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo anular"
        toast.error(message)
      }
    })
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-4">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-foreground">
        Buscar pedido
      </h2>

      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <Input
          placeholder="Buscar por teléfono"
          value={phoneQuery}
          onChange={(event) => setPhoneQuery(event.target.value)}
        />
        <Button onClick={handleSearch} disabled={isPending}>
          Buscar
        </Button>
      </div>

      {results.length === 0 ? (
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
              <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                Estado: {order.status}
              </p>

              <ul className="mt-2 list-disc pl-5 text-sm">
                {(order.order_items ?? []).map((item, idx) => (
                  <li key={`${order.id}-${idx}`}>
                    {item.type === "cake" ? "Tarta" : "Cajita"} · {item.flavor} · {item.qty}
                  </li>
                ))}
              </ul>

              <div className="mt-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Anular
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Seguro que quieres anular este pedido?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción marcará el pedido como cancelado y dejará de contar en producción.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-2">
                      <Label htmlFor={`reason-${order.id}`}>Motivo (opcional)</Label>
                      <Textarea
                        id={`reason-${order.id}`}
                        value={reasonByOrder[order.id] ?? ""}
                        onChange={(event) =>
                          setReasonByOrder((prev) => ({ ...prev, [order.id]: event.target.value }))
                        }
                        placeholder="Motivo de anulación"
                      />
                    </div>

                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleCancel(order.id)}>
                        Confirmar anulación
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
