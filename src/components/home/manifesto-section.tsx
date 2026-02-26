import Image from "next/image"

export function ManifestoSection() {
  return (
    <section className="border-t border-border py-16 md:py-24">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
        <div className="grid items-center gap-10 md:grid-cols-2">
          {/* Images */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
              <Image
                src="/images/gallery-1.jpg"
                alt="Proceso artesanal"
                fill
                className="object-cover"
              />
            </div>
            <div className="relative mt-8 aspect-[3/4] overflow-hidden bg-secondary">
              <Image
                src="/images/fachada.webp"
                alt="Interior de la galer&iacute;a"
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* Text */}
          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-bold uppercase leading-snug tracking-[0.05em] text-foreground md:text-3xl lg:text-4xl text-balance">
              Donde hacemos nuestra <em className="not-italic text-primary">dulce</em> magia...
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {"Un templo de aquellas peque\u00f1as cosas que, sin saber muy bien por qu\u00e9, a veces necesitamos saborear s\u00ed o s\u00ed. Un museo de los impulsos m\u00e1s dulces. Un templo del aut\u00e9ntico sabor."}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {"Porque en SayCheese sabemos que, cuando algo est\u00e1 exageradamente bueno, nos olvidamos de todo y de todos, y lo \u00fanico que queremos es comernos lo que tenemos entre las manos, esperando que nadie, absolutamente nadie, nos pida un poco."}
            </p>

          </div>
        </div>
      </div>
    </section>
  )
}
