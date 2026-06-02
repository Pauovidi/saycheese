import type { Metadata } from "next"
import { BUSINESS_EMAIL, BUSINESS_LEGAL_NAME, BUSINESS_NIF, STORE_ADDRESS } from "@/src/data/business"

export const metadata: Metadata = {
  title: "Aviso Legal | Tentados by Néstor Pérez",
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
            <li><strong>Titular:</strong> {BUSINESS_LEGAL_NAME}</li>
            <li><strong>NIF:</strong> {BUSINESS_NIF}</li>
            <li><strong>Direccion:</strong> {STORE_ADDRESS}</li>
            <li><strong>Correo electronico:</strong> {BUSINESS_EMAIL}</li>
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
