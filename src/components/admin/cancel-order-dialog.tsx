"use client"

import { useState } from "react"

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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type CancelOrderDialogProps = {
  orderId: string
  onConfirm: (orderId: string, reason?: string) => void
}

export function CancelOrderDialog({ orderId, onConfirm }: CancelOrderDialogProps) {
  const [reason, setReason] = useState("")

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Anular pedido
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
          <Label htmlFor={`reason-${orderId}`}>Motivo (opcional)</Label>
          <Textarea
            id={`reason-${orderId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motivo de anulación"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(orderId, reason || undefined)}>
            Confirmar anulación
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
