import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Politica de Privacidad | SayCheese",
}

export default function PrivacidadPage() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-[900px] px-6 lg:px-10">
        <h1 className="mb-10 text-2xl font-bold uppercase tracking-[0.15em] text-foreground md:text-3xl">
          Politica de Privacidad
        </h1>
        <div className="flex flex-col gap-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            De conformidad con lo establecido en el Reglamento (UE) 2016/679
            (RGPD) y la normativa vigente en materia de proteccion de datos, se
            informa a los usuarios de los siguientes aspectos:
          </p>

          <h2 className="text-base font-bold uppercase tracking-wider text-foreground">Responsable del tratamiento</h2>
          <ul className="list-inside list-disc space-y-1">
            <li><strong>Titular:</strong> Saycheese By Nestor Perez</li>
            <li><strong>NIF:</strong> 54269855K</li>
            <li><strong>Direccion:</strong> Calle Abian 4</li>
            <li><strong>Correo electronico:</strong> Saycheesebynp@gmail.com</li>
          </ul>

          <h2 className="text-base font-bold uppercase tracking-wider text-foreground">Datos que se tratan</h2>
          <p>
            Los datos personales que se tratan son los facilitados voluntariamente
            por el usuario al contactar por telefono o WhatsApp, como el numero
            de telefono y los datos necesarios para la gestion del pedido.
          </p>

          <h2 className="text-base font-bold uppercase tracking-wider text-foreground">Finalidad del tratamiento</h2>
          <p>
            Gestionar los pedidos realizados por los clientes y atender las
            consultas relacionadas con los mismos.
          </p>

          <h2 className="text-base font-bold uppercase tracking-wider text-foreground">Base legal</h2>
          <p>
            El tratamiento de los datos se basa en el consentimiento del usuario
            al contactar por telefono o WhatsApp.
          </p>

          <h2 className="text-base font-bold uppercase tracking-wider text-foreground">Conservacion de los datos</h2>
          <p>
            Los datos se conservaran unicamente durante el tiempo necesario para
            gestionar el pedido y cumplir con las obligaciones legales
            correspondientes.
          </p>

          <h2 className="text-base font-bold uppercase tracking-wider text-foreground">Cesion de datos</h2>
          <p>
            No se cederan datos personales a terceros, salvo obligacion legal.
          </p>

          <h2 className="text-base font-bold uppercase tracking-wider text-foreground">Derechos del usuario</h2>
          <p>
            El usuario puede ejercer sus derechos de acceso, rectificacion,
            supresion, oposicion, limitacion y portabilidad de sus datos enviando
            una solicitud al correo electronico indicado anteriormente.
          </p>

          <h2 className="text-base font-bold uppercase tracking-wider text-foreground">Medidas de seguridad</h2>
          <p>
            El titular adopta las medidas necesarias para garantizar la seguridad
            y confidencialidad de los datos personales.
          </p>
        </div>
      </div>
    </section>
  )
}
