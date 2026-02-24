import { HeroSection } from "@/src/components/home/hero-section"
import { FeaturedProducts } from "@/src/components/home/featured-products"
import { ManifestoSection } from "@/src/components/home/manifesto-section"

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturedProducts />
      <ManifestoSection />
    </>
  )
}
