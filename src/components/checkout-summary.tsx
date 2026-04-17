"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { earliestPickupDateISO, formatDateEs } from "@/lib/chatbot/date-rules"
import { getOrderPickupDateErrorMessage, validateOrderPickupDate } from "@/lib/pickup-date-validation"
import { CLOSED_PICKUP_DAYS_COPY, getCustomerFacingFormatLabel, PICKUP_ONLY_COPY } from "@/src/data/business"
import { useCart } from "@/src/context/cart-context"

const checkoutSchema = z.object({
  customer_name: z.string().min(1, "El nombre es obligatorio"),
  phone: z.string().min(6, "Teléfono inválido"),
  delivery_date: z
    .string()
    .min(1, "La fecha de recogida es obligatoria")
    .date("Fecha de recogida inválida"),
})

type CheckoutSummaryProps = {
  leadDays: number
  shopTimeZone: string
}

export function CheckoutSummary({ leadDays, shopTimeZone }: CheckoutSummaryProps) {
  const router = useRouter()
  const { items, subtotal, clearCart } = useCart()
  const [loading, setLoading] = useState(false)
  const [customerName, setCustomerName] = useState("")
  const [phone, setPhone] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [deliveryDateError, setDeliveryDateError] = useState<string | null>(null)

  const payloadItems = useMemo(
    () =>
      items.map((item) => ({
        type: item.product.format === "tarta" ? "cake" : "box",
        flavor: item.product.name,
        qty: item.quantity,
      })),
    [items]
  )
  const earliestPickupDate = useMemo(
    () => earliestPickupDateISO(new Date(), leadDays, shopTimeZone),
    [leadDays, shopTimeZone]
  )
  const pickupDateHelpText = `Elige una fecha de recogida obligatoria. Necesitamos mínimo ${leadDays} días de antelación y ${CLOSED_PICKUP_DAYS_COPY}. Primera fecha disponible: ${formatDateEs(earliestPickupDate, shopTimeZone)}.`

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

  function validateDeliveryDate(value: string) {
    const validation = validateOrderPickupDate(value || undefined, new Date(), leadDays, shopTimeZone)

    if (validation.kind === "valid") {
      setDeliveryDateError(null)
      return validation
    }

    const message = getOrderPickupDateErrorMessage(validation, leadDays, shopTimeZone)
    setDeliveryDateError(message)
    return { ...validation, message }
  }

  function handleDeliveryDateChange(nextValue: string) {
    if (!nextValue) {
      setDeliveryDate("")
      setDeliveryDateError("La fecha de recogida es obligatoria.")
      return
    }

    const validation = validateDeliveryDate(nextValue)
    if (validation.kind !== "valid") {
      setDeliveryDate("")
      toast.error(validation.message)
      return
    }

    setDeliveryDate(validation.pickupDate)
  }

  async function handleConfirmOrder() {
    const parsed = checkoutSchema.safeParse({
      customer_name: customerName.trim(),
      phone,
      delivery_date: deliveryDate,
    })

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisa el formulario")
      return
    }

    const deliveryDateValidation = validateDeliveryDate(parsed.data.delivery_date)
    if (deliveryDateValidation.kind !== "valid") {
      toast.error(deliveryDateValidation.message)
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          delivery_date: deliveryDateValidation.pickupDate,
          items: payloadItems,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "No se pudo crear el pedido")
      }

      clearCart()
      const finalDate = data.delivery_date_final as string | undefined
      toast.success(`Pedido creado para ${finalDate}. ${PICKUP_ONLY_COPY}`)
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
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Tu nombre"
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
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="delivery-date">¿Para qué fecha quieres recoger el pedido? *</Label>
          <Input
            id="delivery-date"
            type="date"
            required
            min={earliestPickupDate}
            value={deliveryDate}
            aria-invalid={deliveryDateError ? "true" : "false"}
            onChange={(e) => handleDeliveryDateChange(e.target.value)}
          />
          <p className={`text-xs ${deliveryDateError ? "text-destructive" : "text-muted-foreground"}`}>
            {deliveryDateError ?? pickupDateHelpText}
          </p>
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
                {getCustomerFacingFormatLabel(item.product.format)} · Cantidad: {item.quantity}
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
        {PICKUP_ONLY_COPY}
      </p>
    </div>
  )
}
