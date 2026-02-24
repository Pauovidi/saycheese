import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { pressArticles, getArticleBySlug } from "@/src/data/press"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return pressArticles.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) return { title: "Artículo no encontrado" }
  return {
    title: `${article.title} | SayCheese Prensa`,
    description: article.excerpt,
  }
}

export default async function PressArticlePage({ params }: Props) {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) notFound()

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-[900px] px-6 lg:px-10">
        <Link
          href="/prensa"
          className="mb-10 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a prensa
        </Link>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-foreground">
            {article.outlet}
          </span>
          <span className="text-xs text-muted-foreground">{article.date}</span>
        </div>

        <h1 className="mb-8 text-2xl font-bold uppercase tracking-[0.05em] text-foreground md:text-3xl">
          {article.title}
        </h1>

        <div className="relative mb-10 aspect-video overflow-hidden bg-secondary">
          <Image
            src={article.image}
            alt={article.title}
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="prose-sm max-w-none">
          <p className="text-sm leading-relaxed text-muted-foreground">{article.content}</p>
        </div>
      </div>
    </section>
  )
}
