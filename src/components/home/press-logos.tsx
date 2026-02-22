const outlets = [
  "El País",
  "Vogue",
  "Forbes",
  "Traveler",
  "Bon Viveur",
  "Hola!",
]

export function PressLogos() {
  return (
    <section className="border-b border-border py-12 md:py-16">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
        <h2 className="mb-10 text-center text-xs font-bold uppercase tracking-[0.3em] text-foreground">
          {"Encu\u00e9ntranos en prensa"}
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
          {outlets.map((name) => (
            <span
              key={name}
              className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
