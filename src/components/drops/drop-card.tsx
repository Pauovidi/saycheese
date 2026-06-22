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
    stock: {
      availableStock: number
    }
  }
}

export function DropCard({ drop }: DropCardProps) {
  return (
    <article className="group flex flex-col">
      <Link href={`/drops/${drop.slug}`} className="relative aspect-square overflow-hidden bg-secondary">
        {drop.imageUrls[0] ? (
          <Image
            src={drop.imageUrls[0]}
            alt={drop.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary p-6 text-center text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Imagen del drop
          </div>
        )}
        <span className="absolute left-2 top-2 bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
          Drops
        </span>
      </Link>
      <div className="flex flex-1 flex-col pt-4">
        <Link href={`/drops/${drop.slug}`}>
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground">{drop.name}</h2>
        </Link>
        <p className="mt-2 text-sm font-semibold text-primary">{drop.priceText}</p>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-3">{drop.description}</p>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span>{getDropStatusLabel(drop.status)}</span>
          <span>{drop.status === "SOLD_OUT" ? "Agotado" : `Quedan ${drop.stock.availableStock}`}</span>
        </div>
      </div>
    </article>
  )
}
