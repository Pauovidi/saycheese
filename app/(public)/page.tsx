export const dynamic = "force-dynamic"

import { HeroSection } from "@/src/components/home/hero-section"
import { FeaturedProducts } from "@/src/components/home/featured-products"
import { ManifestoSection } from "@/src/components/home/manifesto-section"
import { getHeroDrop } from "@/src/data/drops-store"
import { getCatalogFlavors } from "@/src/data/products-store"

export default async function HomePage() {
  const now = new Date()
  const [flavors, heroDrop] = await Promise.all([getCatalogFlavors(), getHeroDrop(now)])
  const dropPromo =
    heroDrop && heroDrop.floatingEnabled && heroDrop.status === "PRELAUNCH"
      ? {
          slug: heroDrop.slug,
          launchAt: heroDrop.launchAt,
          floatingMessage: heroDrop.floatingMessage,
          preorderCtaText: heroDrop.preorderCtaText,
          preorderRemaining: heroDrop.preorderRemaining,
          initialNow: now.toISOString(),
        }
      : null

  return (
    <>
      <HeroSection dropPromo={dropPromo} />
      <FeaturedProducts flavors={flavors} />
      <ManifestoSection />
    </>
  )
}
