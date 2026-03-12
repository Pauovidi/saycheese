import type { Metadata } from "next"

import { PICKUP_ONLY_COPY } from "@/src/data/business"

export const metadata: Metadata = {
  title: "Términos y Condiciones | SayCheese",
}

export default function TerminosPage() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-[900px] px-6 lg:px-10">
        <h1 className="mb-10 text-2xl font-bold uppercase tracking-[0.15em] text-foreground md:text-3xl">
          Términos y Condiciones
        </h1>
        <div className="flex flex-col gap-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            Las presentes condiciones regulan la compra de productos a través de
            la tienda online de SayCheese S.L. Al realizar un pedido, usted
            acepta estas condiciones de forma íntegra.
          </p>
          <p>
            Los precios indicados en la tienda incluyen el IVA aplicable.
            SayCheese se reserva el derecho de modificar los precios en cualquier
            momento, aunque los pedidos ya confirmados mantendrán el precio
            vigente en el momento de la compra.
          </p>
          <p>
            {PICKUP_ONLY_COPY} La fecha de recogida queda confirmada al cerrar
            el pedido y puede ajustarse según disponibilidad del obrador.
          </p>
          <p>
            Al tratarse de productos alimentarios perecederos, no se aceptan
            devoluciones una vez entregado el pedido, salvo que el producto
            presente defectos evidentes o no corresponda con lo solicitado. En
            estos casos, contacte con nosotros en las 24 horas siguientes a la
            entrega.
          </p>
          <p>
            Cualquier controversia derivada del uso de este sitio o de la
            compra de productos se someterá a los juzgados y tribunales de
            Madrid, con renuncia expresa a cualquier otro fuero.
          </p>
        </div>
      </div>
    </section>
  )
}
