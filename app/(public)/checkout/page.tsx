import type { Metadata } from "next"

import { Toaster } from "@/components/ui/sonner"
import { CheckoutSummary } from "@/src/components/checkout-summary"

export const metadata: Metadata = {
  title: "Checkout | SayCheese",
}

const LEAD_DAYS_RAW = Number.parseInt(process.env.CHATBOT_LEAD_DAYS ?? "3", 10)
const LEAD_DAYS = Number.isFinite(LEAD_DAYS_RAW) && LEAD_DAYS_RAW > 0 ? LEAD_DAYS_RAW : 3
const SHOP_TZ = process.env.SHOP_TZ ?? "Europe/Madrid"

export default function CheckoutPage() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-[900px] px-6 lg:px-10">
        <h1 className="mb-14 text-center text-3xl font-bold uppercase tracking-[0.15em] text-foreground md:text-4xl">
          Finalizar compra
        </h1>
        <CheckoutSummary leadDays={LEAD_DAYS} shopTimeZone={SHOP_TZ} />
      </div>
      <Toaster position="bottom-center" />
    </section>
  )
}
