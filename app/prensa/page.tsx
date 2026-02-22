import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { pressArticles } from "@/src/data/press"

export const metadata: Metadata = {
  title: "Prensa | SayCheese",
  description: "SayCheese en los medios. Descubre lo que dicen de nosotros.",
}

export default function PrensaPage() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
        <h1 className="mb-14 text-center text-3xl font-bold uppercase tracking-[0.15em] text-foreground md:text-4xl">
          Prensa
        </h1>
        <div className="flex flex-col gap-0">
          {pressArticles.map((article) => (
            <article
              key={article.id}
              className="flex flex-col gap-6 border-b border-border py-10 first:pt-0 last:border-0 md:flex-row md:items-center"
            >
              <div className="relative aspect-video w-full flex-shrink-0 overflow-hidden bg-secondary md:aspect-square md:w-48">
                <Image
                  src={article.image}
                  alt={article.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-[0.15em] text-foreground">
                    {article.outlet}
                  </span>
                  <span className="text-xs text-muted-foreground">{article.date}</span>
                </div>
                <h2 className="text-lg font-bold uppercase tracking-[0.05em] text-foreground">
                  {article.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {article.excerpt}
                </p>
                <Link
                  href={`/prensa/${article.slug}`}
                  className="mt-1 inline-flex w-fit text-xs font-bold uppercase tracking-[0.15em] text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
                >
                  Ver más
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
