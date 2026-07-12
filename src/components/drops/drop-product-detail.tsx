"use client"

import Image from "next/image"
import { useMemo, useState, useTransition, type FormEvent } from "react"
import { Check, Loader2, Minus, Plus } from "lucide-react"
import { toast } from "sonner"

import { reserveDropPrelaunch } from "@/actions/drops"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCart } from "@/src/context/cart-context"
import type { EditableDropRecord } from "@/src/data/drops-store"
import type { Product } from "@/src/data/products"

function createBrowserIdempotencyKey(dropId: string) {
  const storageKey = `tentados-drop-preorder-${dropId}`
  try {
    const current = window.localStorage.getItem(storageKey)
    if (current) return current
    const next = crypto.randomUUID()
    window.localStorage.setItem(storageKey, next)
    return next
  } catch {
    return `${dropId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function rotateBrowserIdempotencyKey(dropId: string) {
  const storageKey = `tentados-drop-preorder-${dropId}`
  try {
    const next = crypto.randomUUID()
    window.localStorage.setItem(storageKey, next)
    return next
  } catch {
    return `${dropId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function OptionButtons({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string
  options: string[]
  selected: string
  onSelect: (value: string) => void
}) {
  if (!options.length) return null

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-bold uppercase tracking-[0.16em] text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={`min-h-10 border px-4 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
              selected === option
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-foreground hover:border-primary"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function DropProductDetail({ drop }: { drop: EditableDropRecord }) {
  const { addItem } = useCart()
  const isPreorder = drop.status === "PRELAUNCH"
  const usesSizeStock = drop.sizeStockEnabled
  const firstSellableSize = usesSizeStock ? drop.stock.sizeStock.find((entry) => entry.sellableNow > 0)?.size ?? drop.sizes[0] ?? "" : drop.sizes[0] ?? ""
  const [selectedSize, setSelectedSize] = useState(firstSellableSize)
  const [selectedColor, setSelectedColor] = useState(drop.colors[0] ?? "")
  const [customerName, setCustomerName] = useState("")
  const [phone, setPhone] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [reservationDone, setReservationDone] = useState(false)
  const [isPending, startTransition] = useTransition()
  const availableStock = drop.stock.availableStock
  const selectedSizeStock = drop.stock.sizeStock.find((entry) => entry.size === selectedSize)
  const selectedSellable = usesSizeStock ? selectedSizeStock?.sellableNow ?? 0 : availableStock
  const soldOut = !isPreorder && (drop.status === "SOLD_OUT" || availableStock <= 0 || (usesSizeStock && !drop.stock.sizeStock.some((entry) => entry.sellableNow > 0)))
  const cappedQuantity = Math.min(quantity, Math.max(1, selectedSellable))

  const cartProduct = useMemo<Product>(
    () => ({
      id: `drop-${drop.slug}-${usesSizeStock ? selectedSize : "sin-talla"}-${selectedColor}`,
      name: drop.name,
      slug: drop.slug,
      format: "drop",
      category: drop.slug,
      priceText: drop.priceText,
      priceValue: drop.price,
      shortDescription: drop.description,
      fullDescription: drop.description,
      description: drop.description,
      images: drop.imageUrls,
      featured: false,
      dropId: drop.id,
      selectedSize: usesSizeStock ? selectedSize : undefined,
      selectedColor,
      stockAvailable: selectedSellable,
    }),
    [drop, selectedColor, selectedSellable, selectedSize, usesSizeStock]
  )

  function addDropToCart() {
    if (soldOut || selectedSellable <= 0) return
    addItem(cartProduct, cappedQuantity)
    setQuantity(1)
  }

  function submitPreorder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (drop.sizes.length && !selectedSize) {
      toast.error("Selecciona una talla")
      return
    }
    if (!selectedColor) {
      toast.error("Selecciona un color")
      return
    }

    startTransition(async () => {
      let idempotencyKey = createBrowserIdempotencyKey(drop.id)
      let response = await reserveDropPrelaunch({
        dropId: drop.id,
        idempotencyKey,
        customerName,
        phone,
        selectedSize: selectedSize || null,
        selectedColor,
      })

      if (!response.ok && response.code === "reservation_cancelled_idempotency_key") {
        idempotencyKey = rotateBrowserIdempotencyKey(drop.id)
        response = await reserveDropPrelaunch({
          dropId: drop.id,
          idempotencyKey,
          customerName,
          phone,
          selectedSize: selectedSize || null,
          selectedColor,
        })
      }

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      setReservationDone(true)
      toast.success(response.reservation.reusedExisting ? "Tu preventa ya estaba registrada" : "Preventa registrada")
    })
  }

  return (
    <section className="py-12 md:py-20">
      <div className="mx-auto grid max-w-[1600px] gap-10 px-6 md:grid-cols-2 lg:gap-16 lg:px-10">
        <div className="relative aspect-square overflow-hidden bg-secondary">
          {drop.imageUrls[0] ? (
            <Image src={drop.imageUrls[0]} alt={drop.name} fill className="object-cover" priority />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary p-6">
              <p className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">Imagen del drop</p>
            </div>
          )}
          <span className="absolute left-3 top-3 bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            {isPreorder ? "Preventa" : "Drops"}
          </span>
        </div>

        <div className="flex flex-col justify-center">
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{isPreorder ? "Preventa bajo pedido" : "Drop"}</p>
            <h1 className="text-2xl font-bold uppercase tracking-[0.1em] text-foreground md:text-3xl">{drop.name}</h1>
            <p className="text-lg font-semibold text-primary">{drop.priceText}</p>
            <p className="text-sm text-muted-foreground">
              {isPreorder ? "Elige libremente talla y color antes del lanzamiento." : soldOut ? "Agotado" : `Quedan ${availableStock} unidades`}
            </p>
            {!isPreorder && usesSizeStock && drop.stock.sizeStock.length ? (
              <p className="text-sm text-muted-foreground">Tallas: {drop.stock.sizeStock.map((entry) => entry.size).join(", ")}</p>
            ) : null}
            <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{drop.description}</p>
          </div>

          {isPreorder ? (
            <form className="mt-8 space-y-5" onSubmit={submitPreorder}>
              <OptionButtons label="Talla" options={drop.sizes} selected={selectedSize} onSelect={setSelectedSize} />
              <OptionButtons label="Color" options={drop.colors} selected={selectedColor} onSelect={setSelectedColor} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="preorder-name">Nombre y apellidos</Label>
                  <Input id="preorder-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoComplete="name" minLength={3} maxLength={160} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preorder-phone">Teléfono</Label>
                  <Input id="preorder-phone" type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" minLength={6} maxLength={40} required />
                </div>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                La preventa se fabrica bajo pedido y no consume el stock de la venta normal.
              </p>

              <button
                type="submit"
                disabled={isPending || reservationDone || !customerName.trim() || !phone.trim() || !selectedColor || (drop.sizes.length > 0 && !selectedSize)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {reservationDone ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                {reservationDone ? "Preventa registrada" : "Confirmar preventa"}
              </button>
            </form>
          ) : (
            <div className="mt-8 space-y-5">
              {usesSizeStock ? (
                <fieldset className="space-y-2">
                  <legend className="text-xs font-bold uppercase tracking-[0.16em] text-foreground">Talla</legend>
                  <div className="flex flex-wrap gap-2">
                    {drop.sizes.map((size) => {
                      const stock = drop.stock.sizeStock.find((entry) => entry.size === size)
                      const disabled = soldOut || !stock || stock.sellableNow <= 0
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => { setSelectedSize(size); setQuantity(1) }}
                          disabled={disabled}
                          aria-label={disabled ? `${size} agotada` : `${size} disponible`}
                          className={`min-h-10 border px-4 text-xs font-bold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${selectedSize === size ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:border-primary"}`}
                        >
                          {size}{disabled ? <span className="sr-only"> agotada</span> : null}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              ) : null}

              <OptionButtons label="Color" options={drop.colors} selected={selectedColor} onSelect={setSelectedColor} />

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex w-fit items-center border border-border">
                  <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="Reducir cantidad" className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:bg-secondary" disabled={soldOut}>
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-[3rem] text-center text-sm font-medium text-foreground">{cappedQuantity}</span>
                  <button type="button" onClick={() => setQuantity((current) => Math.min(selectedSellable, current + 1))} aria-label="Aumentar cantidad" className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:bg-secondary" disabled={soldOut || selectedSellable <= 0}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button type="button" onClick={addDropToCart} disabled={soldOut || (usesSizeStock && !selectedSize) || !selectedColor || selectedSellable <= 0} className="min-h-11 flex-1 bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50">
                  {soldOut ? "Agotado" : "Añadir al pedido"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
