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
                src="/images/tentados-packaging-cake.jpeg"
                alt="Packaging de Tentados con tarta artesanal"
                fill
                sizes="(min-width: 768px) 25vw, 50vw"
                loading="eager"
                className="object-cover"
              />
            </div>
            <div className="relative mt-8 aspect-[3/4] overflow-hidden bg-secondary">
              <Image
                src="/images/tentados-fachada.jpeg"
                alt="Fachada de Tentados by Néstor Pérez"
                fill
                sizes="(min-width: 768px) 25vw, 50vw"
                loading="eager"
                className="object-cover"
              />
            </div>
          </div>

          {/* Text */}
          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-bold uppercase leading-snug tracking-[0.05em] text-foreground md:text-3xl lg:text-4xl text-balance">
              Donde nace la <em className="not-italic text-primary">tentación</em>
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {"En TENTADOS creemos que hay placeres a los que merece la pena rendirse."}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {"Creamos tartas de queso artesanales elaboradas con ingredientes seleccionados y una obsesión por cada detalle: la textura, el sabor y la experiencia."}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {"Porque cuando algo es realmente irresistible, no se comparte por compromiso. Se disfruta sin prisas."}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {"Bienvenidos a la tentación."}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
