export const dynamic = "force-dynamic"

import { HeroSection } from "@/src/components/home/hero-section"
import { FeaturedProducts } from "@/src/components/home/featured-products"
import { ManifestoSection } from "@/src/components/home/manifesto-section"
import { getCatalogFlavors } from "@/src/data/products-store"

export default async function HomePage() {
  const flavors = await getCatalogFlavors()

  return (
    <>
      <HeroSection />
      <FeaturedProducts flavors={flavors} />
      <ManifestoSection />
    </>
  )
}
