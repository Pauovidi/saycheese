"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { useCart } from "@/src/context/cart-context"
import type { Product } from "@/src/data/products"
import { getSibling } from "@/src/data/products"

interface ProductCardProps {
  product: Product
  priority?: boolean
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const { addItem } = useCart()
  const sibling = getSibling(product)
  const hasBothFormats = !!sibling

  // The card starts showing whichever format was passed in
  const [selectedFormat, setSelectedFormat] = useState<"tarta" | "cajita">(product.format)

  // The actual product to display depends on the selected format
  const displayProduct =
    selectedFormat === product.format ? product : sibling ?? product

  return (
    <article className="group flex flex-col">
      <Link
        href={`/producto/${displayProduct.slug}`}
        className="relative aspect-square overflow-hidden bg-secondary"
      >
        {displayProduct.images.length > 0 ? (
          <Image
            src={displayProduct.images[0]}
            alt={displayProduct.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary p-4">
            <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              En breve subiremos la imagen
            </p>
          </div>
        )}
        {/* Format badge */}
        <span className="absolute left-2 top-2 bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
          {displayProduct.format === "tarta" ? "Tarta" : "Cajita"}
        </span>
      </Link>
      <div className="flex flex-1 flex-col pt-4">
        <Link href={`/producto/${displayProduct.slug}`}>
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-foreground sm:text-sm sm:tracking-[0.15em]">
            {displayProduct.name}
          </h3>
        </Link>

        {/* Format toggle */}
        {hasBothFormats && (
          <div className="mt-2 flex gap-0 self-start border border-border">
            <button
              onClick={() => setSelectedFormat("cajita")}
              className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors sm:text-xs ${
                selectedFormat === "cajita"
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Cajita
            </button>
            <button
              onClick={() => setSelectedFormat("tarta")}
              className={`border-l border-border px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors sm:text-xs ${
                selectedFormat === "tarta"
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Tarta
            </button>
          </div>
        )}

        <p className="mt-2 text-xs font-semibold text-primary sm:text-sm">
          {displayProduct.priceText}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
          {displayProduct.weightInfo}
          {displayProduct.portionInfo ? ` \u00b7 ${displayProduct.portionInfo}` : ""}
        </p>
        <p className="mt-2 flex-1 text-[11px] leading-relaxed text-muted-foreground line-clamp-2 sm:text-xs sm:line-clamp-3">
          {displayProduct.shortDescription}
        </p>
        <button
          onClick={() => addItem(displayProduct, 1)}
          className="mt-4 w-full bg-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-primary-foreground transition-opacity hover:opacity-80 sm:py-3 sm:text-xs sm:tracking-[0.2em]"
        >
          Hacer pedido
        </button>
      </div>
    </article>
  )
}
