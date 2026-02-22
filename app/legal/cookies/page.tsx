import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Política de Cookies | SayCheese",
}

export default function CookiesPage() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-[900px] px-6 lg:px-10">
        <h1 className="mb-10 text-2xl font-bold uppercase tracking-[0.15em] text-foreground md:text-3xl">
          Política de Cookies
        </h1>
        <div className="flex flex-col gap-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            Este sitio web utiliza cookies propias y de terceros para mejorar la
            experiencia de navegación, analizar el tráfico y personalizar
            contenidos.
          </p>
          <p>
            Las cookies técnicas son necesarias para el correcto funcionamiento
            del sitio y se instalan automáticamente. Las cookies analíticas nos
            permiten medir y analizar el comportamiento de los usuarios para
            mejorar nuestros servicios.
          </p>
          <p>
            Puede configurar o rechazar las cookies a través de la configuración
            de su navegador. Tenga en cuenta que bloquear algunas cookies puede
            afectar a la funcionalidad del sitio.
          </p>
          <p>
            Para más información, puede consultar la guía de la AEPD sobre el
            uso de cookies o contactarnos en hola@saycheese.es.
          </p>
        </div>
      </div>
    </section>
  )
}
