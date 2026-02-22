import type { Metadata } from "next"
import { CheckoutSummary } from "@/src/components/checkout-summary"

export const metadata: Metadata = {
  title: "Checkout | SayCheese",
}

export default function CheckoutPage() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-[900px] px-6 lg:px-10">
        <h1 className="mb-14 text-center text-3xl font-bold uppercase tracking-[0.15em] text-foreground md:text-4xl">
          Finalizar compra
        </h1>
        <CheckoutSummary />
      </div>
    </section>
  )
}
