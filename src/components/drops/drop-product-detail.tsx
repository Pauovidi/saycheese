"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import { Minus, Plus } from "lucide-react"

import { useCart } from "@/src/context/cart-context"
import type { EditableDropRecord } from "@/src/data/drops-store"
import type { Product } from "@/src/data/products"

export function DropProductDetail({ drop }: { drop: EditableDropRecord }) {
  const { addItem } = useCart()
  const firstSellableSize = drop.stock.sizeStock.find((entry) => entry.sellableNow > 0)?.size ?? drop.sizes[0] ?? ""
  const [selectedSize, setSelectedSize] = useState(firstSellableSize)
  const [selectedColor, setSelectedColor] = useState(drop.colors[0] ?? "")
  const [quantity, setQuantity] = useState(1)
  const availableStock = drop.stock.availableStock
  const selectedSizeStock = drop.stock.sizeStock.find((entry) => entry.size === selectedSize)
  const selectedSizeSellable = selectedSizeStock?.sellableNow ?? 0
  const soldOut = drop.status === "SOLD_OUT" || availableStock <= 0 || !drop.stock.sizeStock.some((entry) => entry.sellableNow > 0)
  const cappedQuantity = Math.min(quantity, Math.max(1, selectedSizeSellable))

  const cartProduct = useMemo<Product>(
    () => ({
      id: `drop-${drop.slug}-${selectedSize}-${selectedColor}`,
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
      selectedSize,
      selectedColor,
      stockAvailable: selectedSizeSellable,
    }),
    [drop, selectedColor, selectedSize, selectedSizeSellable]
  )

  function addDropToCart() {
    if (soldOut || selectedSizeSellable <= 0) return
    addItem(cartProduct, cappedQuantity)
    setQuantity(1)
  }

  return (
    <section className="py-12 md:py-20">
      <div className="mx-auto grid max-w-[1600px] gap-10 px-6 md:grid-cols-2 lg:gap-16 lg:px-10">
        <div className="relative aspect-square overflow-hidden bg-secondary">
          {drop.imageUrls[0] ? (
            <Image src={drop.imageUrls[0]} alt={drop.name} fill className="object-cover" priority />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary p-6">
              <p className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Imagen del drop
              </p>
            </div>
          )}
          <span className="absolute left-3 top-3 bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            Drops
          </span>
        </div>

        <div className="flex flex-col justify-center">
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Drop</p>
            <h1 className="text-2xl font-bold uppercase tracking-[0.1em] text-foreground md:text-3xl">
              {drop.name}
            </h1>
            <p className="text-lg font-semibold text-primary">{drop.priceText}</p>
            <p className="text-sm text-muted-foreground">
              {soldOut ? "Agotado" : `Quedan ${availableStock} unidades`}
            </p>
            {drop.stock.sizeStock.length ? (
              <p className="text-sm text-muted-foreground">
                Tallas: {drop.stock.sizeStock.map((entry) => `${entry.size} (${entry.sellableNow})`).join(", ")}
              </p>
            ) : null}
            <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {drop.description}
            </p>
          </div>

          <div className="mt-8 space-y-5">
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-[0.16em] text-foreground">Talla</legend>
              <div className="flex flex-wrap gap-2">
                {drop.sizes.map((size) => (
                  (() => {
                    const stock = drop.stock.sizeStock.find((entry) => entry.size === size)
                    const disabled = soldOut || !stock || stock.sellableNow <= 0
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setSelectedSize(size)
                          setQuantity(1)
                        }}
                        disabled={disabled}
                        aria-label={disabled ? `${size} agotada` : `${size}, quedan ${stock?.sellableNow ?? 0}`}
                        className={`min-h-10 border px-4 text-xs font-bold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                          selectedSize === size
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-foreground hover:border-primary"
                        }`}
                      >
                        {size}
                        <span className="ml-1 text-[10px]">{disabled ? "Agotada" : stock?.sellableNow}</span>
                      </button>
                    )
                  })()
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-[0.16em] text-foreground">Color</legend>
              <div className="flex flex-wrap gap-2">
                {drop.colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`min-h-10 border px-4 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                      selectedColor === color
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-foreground hover:border-primary"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex w-fit items-center border border-border">
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  aria-label="Reducir cantidad"
                  className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:bg-secondary"
                  disabled={soldOut}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[3rem] text-center text-sm font-medium text-foreground">{cappedQuantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.min(selectedSizeSellable, current + 1))}
                  aria-label="Aumentar cantidad"
                  className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:bg-secondary"
                  disabled={soldOut || selectedSizeSellable <= 0}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={addDropToCart}
                disabled={soldOut || !selectedSize || !selectedColor || selectedSizeSellable <= 0}
                className="min-h-11 flex-1 bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {soldOut ? "Agotado" : "Añadir al pedido"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
