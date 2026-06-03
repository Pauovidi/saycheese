import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { buildFlavorListMessage } from "../lib/chatbot/products"
import { BUSINESS_LEGAL_NAME, PICKUP_ONLY_COPY, STORE_ADDRESS } from "../src/data/business"
import { faqs } from "../src/data/faqs"

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

const oldDistanceCopyPattern = new RegExp(`${["3", "K[mM]"].join("\\s+")}|${["a la", "redonda"].join(" ")}`)
const oldBrandBylinePattern = new RegExp(`${["Say", "Cheese"].join("")} by|${["Say", "Cheese"].join(" ")} by`)
const oldAwardClaimPattern = new RegExp(["Prem", "iada"].join(""), "i")

test("mantiene la marca visible Tentados en header, footer y metadatos", () => {
  const visibleBrandSources = [
    readSource("src/components/site-header.tsx"),
    readSource("src/components/site-footer.tsx"),
    readSource("app/layout.tsx"),
    readSource("lib/mailer.ts"),
  ].join("\n")

  assert.equal(BUSINESS_LEGAL_NAME, "Tentados by Néstor Pérez")
  assert.match(visibleBrandSources, /Tentados by Néstor Pérez/)
  assert.doesNotMatch(visibleBrandSources, oldBrandBylinePattern)
})

test("top bar comunica Uber Eats en Zona Teide sin copy de distancia anterior", () => {
  const header = readSource("src/components/site-header.tsx")

  assert.match(header, /Con Uber Eats recibe tu tarta en casa \(Zona Teide\)/)
  assert.doesNotMatch(header, oldDistanceCopyPattern)
})

test("FAQ y fuente central de envíos usan Zona Teide sin cobertura antigua", () => {
  const shippingFaq = faqs.find((faq) => faq.question.includes("envíos"))
  const faqText = faqs.map((faq) => `${faq.question} ${faq.answer}`).join("\n")

  assert.ok(shippingFaq)
  assert.equal(PICKUP_ONLY_COPY, "Solo recogida en tienda, salvo si estás en Zona Teide, donde Uber Eats te la deja en casita.")
  assert.equal(shippingFaq.answer, PICKUP_ONLY_COPY)
  assert.match(faqText, /Zona Teide/)
  assert.doesNotMatch(faqText, oldDistanceCopyPattern)
})

test("chatbot conserva sabores y copy de recogida en Zona Teide", () => {
  const reply = buildFlavorListMessage(
    [
      {
        flavor: "Dubai pistacho",
        sizes: [
          { format: "tarta", label: "grande", priceText: "35 €" },
          { format: "cajita", label: "cajita", priceText: "12 €" },
        ],
        isMonthlySpecial: true,
        isMonthlySpecialActive: true,
      },
    ],
    { channel: "whatsapp", leadDays: 3 }
  )

  assert.match(reply, /Tarta del mes: Dubai pistacho/)
  assert.match(reply, /Grande: 35 €/)
  assert.match(reply, /Cajita: 12 €/)
  assert.match(reply, /Zona Teide/)
  assert.doesNotMatch(reply, oldDistanceCopyPattern)
})

test("hero elimina claim secundario y overlay rojo", () => {
  const hero = readSource("src/components/home/hero-section.tsx")

  assert.match(hero, /Nuestra mejor obra de arte/i)
  assert.match(hero, /Ver tartas/i)
  assert.doesNotMatch(hero, oldAwardClaimPattern)
  assert.doesNotMatch(hero, /bg-\[#601116\]\/50/)
})

test("home usa las fotos reales de packaging y fachada de Tentados", () => {
  const manifesto = readSource("src/components/home/manifesto-section.tsx")

  assert.match(manifesto, /\/images\/tentados-packaging-cake\.jpeg/)
  assert.match(manifesto, /\/images\/tentados-fachada\.jpeg/)
  assert.match(manifesto, /Packaging de Tentados con tarta artesanal/)
  assert.match(manifesto, /Fachada de Tentados by Néstor Pérez/)
})

test("home muestra el copy de tentación junto a las fotos", () => {
  const manifesto = readSource("src/components/home/manifesto-section.tsx")

  assert.match(manifesto, /Donde nace la/)
  assert.match(manifesto, /tentación/)
  assert.match(manifesto, /En TENTADOS creemos que hay placeres/)
  assert.match(manifesto, /Creamos tartas de queso artesanales/)
  assert.match(manifesto, /Se disfruta sin prisas/)
  assert.match(manifesto, /Bienvenidos a la tentación/)
})

test("selector de formato no redirige cajita de vuelta a grande", () => {
  const detail = readSource("src/components/product/product-detail.tsx")

  assert.doesNotMatch(detail, /router\.replace\(`\/producto\/\$\{sibling\.slug\}`\)/)
  assert.match(detail, /router\.push\(`\/producto\/\$\{sibling\.slug\}`\)/)
  assert.match(detail, /product\.format === "cajita"/)
  assert.match(detail, /addItem\(product, quantity\)/)
})

test("ubicación oficial permanece centralizada", () => {
  assert.equal(STORE_ADDRESS, "C. Abián, 4, 35212 Marpequeña, Las Palmas")
})
