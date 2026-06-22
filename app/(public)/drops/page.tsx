import type { Metadata } from "next"

import { DropCard } from "@/src/components/drops/drop-card"
import { listPublicDrops } from "@/src/data/drops-store"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Drops | Tentados by Néstor Pérez",
  description: "Drops de merchandising de Tentados by Néstor Pérez.",
}

export default async function DropsPage() {
  const drops = await listPublicDrops()

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
        <h1 className="text-center text-3xl font-bold uppercase tracking-[0.15em] text-foreground md:text-4xl">
          Drops
        </h1>
        {drops.length ? (
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {drops.map((drop) => (
              <DropCard key={drop.id} drop={drop} />
            ))}
          </div>
        ) : (
          <div className="mx-auto mt-12 max-w-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Ahora mismo no hay drops disponibles.</p>
          </div>
        )}
      </div>
    </section>
  )
}
