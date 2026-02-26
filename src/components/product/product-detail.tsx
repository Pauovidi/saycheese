"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Minus, Plus } from "lucide-react"
import { useCart } from "@/src/context/cart-context"
import type { Product } from "@/src/data/products"
import { getSibling } from "@/src/data/products"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface ProductDetailProps {
  product: Product
}

export function ProductDetail({ product }: ProductDetailProps) {
  const [quantity, setQuantity] = useState(1)
  const { addItem } = useCart()
  const router = useRouter()
  const sibling = getSibling(product)
  const hasBothFormats = !!sibling

  useEffect(() => {
    if (hasBothFormats && product.format === "cajita" && sibling) {
      router.replace(`/producto/${sibling.slug}`)
    }
  }, [hasBothFormats, product.format, router, sibling])

  function switchFormat(format: "tarta" | "cajita") {
    if (format === product.format) return
    if (sibling) router.push(`/producto/${sibling.slug}`)
  }

  return (
    <section className="py-12 md:py-20">
      <div className="mx-auto grid max-w-[1600px] gap-10 px-6 md:grid-cols-2 lg:gap-16 lg:px-10">
        {/* Gallery */}
        <div className="relative aspect-square overflow-hidden bg-secondary">
          {product.images.length > 0 ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary p-6">
              <p className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
                En breve subiremos la imagen
              </p>
            </div>
          )}
          <span className="absolute left-3 top-3 bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
            {product.format === "tarta" ? "Tarta" : "Cajita"}
          </span>
        </div>

        {/* Info */}
        <div className="flex flex-col justify-center">
          <h1 className="text-2xl font-bold uppercase tracking-[0.1em] text-foreground md:text-3xl">
            {product.name}
          </h1>

          {/* Format Selector */}
          {hasBothFormats && (
            <div className="mt-4 flex gap-0 self-start border border-border">
              <button
                onClick={() => switchFormat("tarta")}
                className={`px-5 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                  product.format === "tarta"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Tarta &mdash; {(sibling && product.format === "cajita" ? sibling : product).priceText}
              </button>
              <button
                onClick={() => switchFormat("cajita")}
                className={`border-l border-border px-5 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                  product.format === "cajita"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Cajita &mdash; {(sibling && product.format === "tarta" ? sibling : product).priceText}
              </button>
            </div>
          )}

          <p className="mt-3 text-lg font-semibold text-primary">{product.priceText}</p>

          {/* Weight / Portions info */}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {product.weightInfo && <span>{product.weightInfo}</span>}
            {product.portionInfo && (
              <>
                <span className="text-border">|</span>
                <span>{product.portionInfo}</span>
              </>
            )}
          </div>

          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            {product.fullDescription || product.shortDescription}
          </p>

          {/* Quantity + Hacer pedido */}
          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center border border-border">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Reducir cantidad"
                className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:bg-secondary"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[3rem] text-center text-sm font-medium text-foreground">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Aumentar cantidad"
                className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:bg-secondary"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => {
                addItem(product, quantity)
                setQuantity(1)
              }}
              className="flex-1 bg-primary py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground transition-opacity hover:opacity-80"
            >
              Hacer pedido
            </button>
          </div>

          {/* Accordion */}
          <div className="mt-10">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="formato">
                <AccordionTrigger className="text-xs font-bold uppercase tracking-[0.15em] text-foreground">
                  Formato
                </AccordionTrigger>
                <AccordionContent className="text-xs leading-relaxed text-muted-foreground">
                  <p><strong>Cajita:</strong> 400 g. Formato individual o para compartir.</p>
                  <p className="mt-1"><strong>Tarta:</strong> 1,7 kg. 10-12 raciones. Formato grande.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="conservacion">
                <AccordionTrigger className="text-xs font-bold uppercase tracking-[0.15em] text-foreground">
                  {"Conservaci\u00f3n / Env\u00edo"}
                </AccordionTrigger>
                <AccordionContent className="text-xs leading-relaxed text-muted-foreground">
                  {"Env\u00edo refrigerado en 24-48 h. La tarta se conserva 5 d\u00edas en nevera (2-4 \u00b0C). No congelar. Al recibir tu pedido, col\u00f3cala directamente en la nevera. S\u00e1cala 15-20 minutos antes de consumir."}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="alergenos">
                <AccordionTrigger className="text-xs font-bold uppercase tracking-[0.15em] text-foreground">
                  {"Al\u00e9rgenos"}
                </AccordionTrigger>
                <AccordionContent className="text-xs leading-relaxed text-muted-foreground">
                  {"Todas nuestras tartas contienen l\u00e1cteos, huevo y gluten. Algunas variedades contienen frutos secos (pistacho) o soja. Consulta la ficha de cada sabor para m\u00e1s detalles."}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  )
}
