"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { cancelDropReservationFromAdmin } from "@/actions/drops"
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
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { DropModuleAvailability } from "@/src/data/drop-storage-status"
import type { DropOrderListItem, DropReservationListItem } from "@/src/data/drops-store"

function formatDate(value: string) {
  if (!value) return "Sin fecha"
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function ShirtsAdmin({
  initialReservations,
  initialOrders,
  moduleAvailability = "READY",
  moduleMessage,
}: {
  initialReservations: DropReservationListItem[]
  initialOrders: DropOrderListItem[]
  moduleAvailability?: DropModuleAvailability
  moduleMessage?: string
}) {
  const [reservations, setReservations] = useState(initialReservations)
  const [isPending, startTransition] = useTransition()
  const moduleReady = moduleAvailability === "READY"

  function cancelReservation(reservationId: string) {
    if (!moduleReady) return

    startTransition(async () => {
      const response = await cancelDropReservationFromAdmin({
        reservationId,
        reason: "Cancelada desde backoffice",
      })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      setReservations((current) =>
        current.map((reservation) =>
          reservation.id === reservationId
            ? {
                ...reservation,
                status: "cancelled",
                cancelledAt: new Date().toISOString(),
                cancellationReason: "Cancelada desde backoffice",
                stockEffect: "Sin consumo",
              }
            : reservation
        )
      )
      toast.success(response.result.changed ? "Preventa cancelada" : "La preventa ya estaba cancelada")
    })
  }

  return (
    <Tabs defaultValue="preventas" className="space-y-6">
      {!moduleReady ? (
        <Card className="border-amber-300 bg-amber-50 text-amber-950">
          <CardHeader>
            <CardTitle>Módulo no inicializado</CardTitle>
            <CardDescription className="text-amber-900">
              {moduleMessage ?? "La migración de Drops todavía no está aplicada en este entorno."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <TabsList>
        <TabsTrigger value="preventas">Preventas</TabsTrigger>
        <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
      </TabsList>

      <TabsContent value="preventas" className="space-y-3">
        {reservations.length ? (
          reservations.map((reservation) => (
            <article key={reservation.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-foreground">{reservation.dropName}</p>
                  <p className="text-muted-foreground">ID: {reservation.id}</p>
                  <p className="text-muted-foreground">Fecha: {formatDate(reservation.createdAt)}</p>
                  <p className="text-muted-foreground">Cantidad: {reservation.quantity}</p>
                  <p className="text-muted-foreground">Referencia: {reservation.customerReference ?? "Sin referencia"}</p>
                  <p className="text-muted-foreground">Efecto stock: {reservation.stockEffect}</p>
                </div>
                <div className="flex flex-col items-start gap-3 md:items-end">
                  <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]">
                    {reservation.status === "active" ? "Activa" : "Cancelada"}
                  </span>
                  {reservation.status === "active" ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isPending || !moduleReady}>
                          Cancelar preventa
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Cancelar esta preventa?</AlertDialogTitle>
                          <AlertDialogDescription>
                            La cancelación devolverá una unidad al stock una sola vez. No se creará ningún pedido.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Volver</AlertDialogCancel>
                          <AlertDialogAction onClick={() => cancelReservation(reservation.id)}>
                            Sí, cancelar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            {moduleReady ? "Todavía no hay preventas." : moduleMessage ?? "La migración de Drops todavía no está aplicada en este entorno."}
          </p>
        )}
      </TabsContent>

      <TabsContent value="pedidos" className="space-y-3">
        {initialOrders.length ? (
          initialOrders.map((order) => (
            <article key={order.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-foreground">{order.dropName}</p>
                  <p className="text-muted-foreground">Pedido: {order.orderId}</p>
                  <p className="text-muted-foreground">Fecha pedido: {formatDate(order.createdAt)}</p>
                  <p className="text-muted-foreground">Recogida: {order.deliveryDate}</p>
                  <p className="text-muted-foreground">{order.customerName ?? "Sin nombre"} · {order.phone ?? "Sin teléfono"}</p>
                  <p className="text-muted-foreground">Talla: {order.size} · Color: {order.color}</p>
                </div>
                <div className="text-left text-sm md:text-right">
                  <p className="font-semibold">
                    {order.quantity} x {order.priceText}
                  </p>
                  <p className="mt-1 rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]">
                    {order.status}
                  </p>
                </div>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            {moduleReady ? "Todavía no hay pedidos de camisetas." : moduleMessage ?? "La migración de Drops todavía no está aplicada en este entorno."}
          </p>
        )}
      </TabsContent>
    </Tabs>
  )
}
