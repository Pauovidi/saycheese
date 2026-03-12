export function HeroSection() {
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
      <div className="absolute inset-0 bg-[#3b2314]/50" />
      <div className="relative z-10 flex flex-col items-center gap-6 px-4 text-center">
        <h2 className="max-w-3xl text-4xl font-bold uppercase leading-tight tracking-[0.1em] text-[#fffdf8] md:text-6xl lg:text-7xl text-balance">
          Nuestra mejor obra de arte
        </h2>
        <p className="text-sm font-light uppercase tracking-[0.2em] text-[#FFDD98] md:text-base">
          {"Premiada como mejor cheesecake 2025 del mundo mundial por nuestros exquisitos clientes"}
        </p>
        <a
          href="#nuestros-sabores"
          className="mt-4 border-2 border-[#FFDD98] bg-transparent px-8 py-3.5 text-xs font-bold uppercase tracking-[0.25em] text-[#FFDD98] transition-colors hover:bg-[#FFDD98] hover:text-[#3b2314]"
        >
          Ver sabores
        </a>
      </div>
    </section>
  )
}
