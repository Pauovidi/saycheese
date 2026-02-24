import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Aviso Legal | SayCheese",
}

export default function AvisoLegalPage() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-[900px] px-6 lg:px-10">
        <h1 className="mb-10 text-2xl font-bold uppercase tracking-[0.15em] text-foreground md:text-3xl">
          Aviso Legal
        </h1>
        <div className="flex flex-col gap-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            En cumplimiento con lo dispuesto en la Ley 34/2002, de Servicios de
            la Sociedad de la Informacion y del Comercio Electronico (LSSI-CE),
            se informa a los usuarios de los siguientes datos:
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li><strong>Titular:</strong> Saycheese By Nestor Perez</li>
            <li><strong>NIF:</strong> 54269855K</li>
            <li><strong>Direccion:</strong> Calle Abian 4</li>
            <li><strong>Correo electronico:</strong> Saycheesebynp@gmail.com</li>
            <li><strong>Actividad:</strong> Venta de productos alimenticios y bebidas</li>
          </ul>
          <p>
            El acceso y uso de este sitio web atribuye la condicion de usuario e
            implica la aceptacion de las condiciones aqui reflejadas. El titular
            se reserva el derecho a modificar, en cualquier momento y sin previo
            aviso, la presentacion, configuracion y contenido del sitio web.
          </p>
        </div>
      </div>
    </section>
  )
}
