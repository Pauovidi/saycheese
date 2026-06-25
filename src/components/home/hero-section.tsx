import { HeroDropFloating } from "@/src/components/drops/hero-drop-floating"

type HeroSectionProps = {
  dropPromo?: {
    id: string
    slug: string
    name: string
    launchAt: string
    floatingMessage: string
    preorderCtaText?: string
    availableStock: number
    status: "PRELAUNCH" | "SOLD_OUT"
  } | null
}

export function HeroSection({ dropPromo }: HeroSectionProps) {
  return (
    <section className="relative flex min-h-[85vh] items-center justify-center overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        poster="/images/hero.jpg"
      >
        <source src="/videos/hero.mp4" type="video/mp4" />
      </video>
      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-7 px-5 text-center sm:px-6 md:gap-8">
        {dropPromo ? <HeroDropFloating drop={dropPromo} /> : null}
        <h2 className="max-w-3xl text-4xl font-bold uppercase leading-tight tracking-[0.1em] text-[#fffdf8] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] md:text-6xl lg:text-7xl text-balance">
          Nuestra mejor obra de arte
        </h2>
        <a
          href="#nuestros-sabores"
          className="mt-4 border-2 border-[#f4eed4] bg-transparent px-8 py-3.5 text-xs font-bold uppercase tracking-[0.25em] text-[#f4eed4] drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-colors hover:bg-[#f4eed4] hover:text-[#601116]"
        >
          Ver tartas
        </a>
      </div>
    </section>
  )
}
