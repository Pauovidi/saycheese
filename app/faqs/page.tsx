import type { Metadata } from "next"
import { faqs } from "@/src/data/faqs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export const metadata: Metadata = {
  title: "FAQs | SayCheese",
  description: "Preguntas frecuentes sobre env\u00edos, al\u00e9rgenos, pedidos y m\u00e1s.",
}

export default function FaqsPage() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-[900px] px-6 lg:px-10">
        <h1 className="mb-14 text-center text-3xl font-bold uppercase tracking-[0.15em] text-foreground md:text-4xl">
          Preguntas frecuentes
        </h1>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-sm font-bold uppercase tracking-[0.05em] text-foreground">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
