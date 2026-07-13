import Image from "next/image"
import Link from "next/link"

import { getDropStatusLabel, type DropPublicStatus } from "@/src/data/drops"

type DropCardProps = {
  drop: {
    slug: string
    name: string
    description: string
    priceText: string
    imageUrls: string[]
    status: DropPublicStatus
    preorderRemaining: number
    stock: {
      availableStock: number
      sizeStock?: Array<{ sellableNow: number }>
    }
  }
}

export function DropCard({ drop }: DropCardProps) {
  const isPreorder = drop.status === "PRELAUNCH"
  const hasSellableSize = drop.stock.sizeStock?.some((entry) => entry.sellableNow > 0) ?? true
  const soldOut = !isPreorder && (drop.status === "SOLD_OUT" || drop.stock.availableStock <= 0 || !hasSellableSize)
  const preorderSoldOut = isPreorder && drop.preorderRemaining <= 0
  const stockLabel = isPreorder
    ? preorderSoldOut
      ? "Preventa agotada"
      : `Preventa · Quedan ${drop.preorderRemaining}`
    : soldOut
    ? "Agotado"
    : `${getDropStatusLabel(drop.status)} \u00b7 Quedan ${drop.stock.availableStock}`

  return (
    <article className="group flex flex-col">
      <Link href={`/drops/${drop.slug}`} className="relative aspect-square overflow-hidden bg-secondary">
        {drop.imageUrls[0] ? (
          <Image
            src={drop.imageUrls[0]}
            alt={drop.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary p-4">
            <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              En breve subiremos la imagen
            </p>
          </div>
        )}
        <span className="absolute left-2 top-2 bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
          Drops
        </span>
      </Link>
      <div className="flex flex-1 flex-col pt-4">
        <Link href={`/drops/${drop.slug}`}>
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-foreground sm:text-sm sm:tracking-[0.15em]">
            {drop.name}
          </h2>
        </Link>
        <p className="mt-2 text-xs font-semibold text-primary sm:text-sm">{drop.priceText}</p>
        <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">{stockLabel}</p>
        <p className="mt-2 flex-1 text-[11px] leading-relaxed text-muted-foreground line-clamp-2 sm:text-xs sm:line-clamp-3">
          {drop.description}
        </p>
        {soldOut || preorderSoldOut ? (
          <span
            aria-disabled="true"
            className="mt-4 w-full bg-primary px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-primary-foreground opacity-50 sm:py-3 sm:text-xs sm:tracking-[0.2em]"
          >
            {preorderSoldOut ? "Preventa agotada" : "Agotado"}
          </span>
        ) : (
          <Link
            href={`/drops/${drop.slug}`}
            className="mt-4 w-full bg-primary px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-primary-foreground transition-opacity hover:opacity-80 sm:py-3 sm:text-xs sm:tracking-[0.2em]"
          >
            {isPreorder ? "Reservar en preventa" : "Hacer pedido"}
          </Link>
        )}
      </div>
    </article>
  )
}
