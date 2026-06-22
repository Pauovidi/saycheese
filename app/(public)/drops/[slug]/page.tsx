export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DropProductDetail } from "@/src/components/drops/drop-product-detail"
import { getPublicDropBySlug } from "@/src/data/drops-store"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const drop = await getPublicDropBySlug(slug)
  if (!drop) return { title: "Drop no encontrado" }

  return {
    title: `${drop.name} | Drops | Tentados by Néstor Pérez`,
    description: drop.description,
  }
}

export default async function DropPage({ params }: Props) {
  const { slug } = await params
  const drop = await getPublicDropBySlug(slug)
  if (!drop) notFound()

  return <DropProductDetail drop={drop} />
}
