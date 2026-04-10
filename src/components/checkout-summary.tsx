"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCart } from "@/src/context/cart-context"

const checkoutSchema = z.object({
  customer_name: z.string().trim().min(1, "El nombre es obligatorio"),
  customer_email: z.string().trim().email("Email inválido").optional(),
  phone: z.string().min(6, "Teléfono inválido"),
  delivery_date: z.string().date("Fecha de entrega inválida").optional(),
  notes: z.string().optional(),
})

export function CheckoutSummary() {
  const router = useRouter()
  const { items, subtotal, clearCart } = useCart()
  const [loading, setLoading] = useState(false)
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [notes, setNotes] = useState("")

  const payloadItems = useMemo(
    () =>
      items.map((item) => ({
        type: item.product.format === "tarta" ? "cake" : "box",
        flavor: item.product.name,
        qty: item.quantity,
      })),
    [items]
  )

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <p className="text-sm text-muted-foreground">Tu carrito está vacío.</p>
        <Link
          href="/productos"
          className="border border-foreground px-8 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-foreground hover:text-background"
        >
          Ver productos
        </Link>
      </div>
    )
  }

  async function handleConfirmOrder() {
    const parsed = checkoutSchema.safeParse({
      customer_name: customerName,
      customer_email: customerEmail || undefined,
      phone,
      delivery_date: deliveryDate || undefined,
      notes: notes || undefined,
    })

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisa el formulario")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          items: payloadItems,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "No se pudo crear el pedido")
      }

      clearCart()
      const finalDate = data.delivery_date_final as string | undefined
      const warningEmail = data.warningEmail as boolean | undefined

      toast.success(
        warningEmail
          ? `Pedido creado para ${finalDate}. No se pudo enviar el email de confirmación.`
          : customerEmail
            ? `Pedido creado para ${finalDate}. Te enviamos un email de confirmación.`
            : `Pedido creado para ${finalDate}.`
      )
      router.push("/")
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al crear pedido"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 rounded-md border border-border p-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="customer-name">Nombre *</Label>
          <Input
            id="customer-name"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Tu nombre"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-email">Email (opcional)</Label>
          <Input
            id="customer-email"
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="tu@email.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-phone">Teléfono *</Label>
          <Input
            id="customer-phone"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="600123123"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="delivery-date">¿Necesitas la tarta para alguna fecha en concreto?</Label>
          <Input
            id="delivery-date"
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Si no indicas fecha, se programará para dentro de 3 días (aprox.).
          </p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="order-notes">Notas (opcional)</Label>
          <Textarea
            id="order-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalles de entrega o recogida"
          />
        </div>
      </div>

      <div className="border-b border-border pb-6">
        {items.map((item) => (
          <div
            key={item.product.id}
            className="flex items-center justify-between border-t border-border py-4 first:border-0"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                {item.product.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.product.format === "tarta" ? "Tarta" : "Cajita"} · Cantidad: {item.quantity}
              </p>
            </div>
            <p className="text-sm font-medium text-foreground">
              {(item.product.priceValue * item.quantity).toFixed(2)}€
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-wider text-foreground">Total</span>
        <span className="text-lg font-bold text-foreground">{subtotal.toFixed(2)}€</span>
      </div>

      <button
        onClick={handleConfirmOrder}
        disabled={loading}
        className="w-full bg-primary py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Creando pedido..." : "Confirmar pedido"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Esta es una página de demostración. No se realizará ningún cargo real.
      </p>
    </div>
  )
}
