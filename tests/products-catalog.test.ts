import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildFlavorRecordsFromProducts,
  buildProductsFromFlavorRecords,
  filterAvailableFlavorRecords,
  products,
  seedFlavorRecords,
} from "../src/data/products"

test("agrupa el dataset semilla por sabor editable", () => {
  const records = buildFlavorRecordsFromProducts(products)
  const categories = new Set(products.map((product) => product.category))

  assert.equal(records.length, categories.size)
  assert.deepEqual(records.map((record) => record.slug), seedFlavorRecords.map((record) => record.slug))
})

test("genera los dos formatos públicos desde un sabor editable", () => {
  const generated = buildProductsFromFlavorRecords([
    {
      slug: "lotus",
      name: "Lotus",
      description: "Toque caramelizado.",
      allergens: "Leche, gluten",
      tartaImage: "/images/products/tarta-lotus.webp",
      cajitaImage: "/images/products/cajita-lotus.webp",
      tartaPrice: 36,
      cajitaPrice: 13.5,
      position: 0,
    },
  ])

  assert.equal(generated.length, 2)
  assert.equal(generated[0].slug, "cajita-lotus")
  assert.equal(generated[1].slug, "tarta-lotus")
  assert.equal(generated[0].priceValue, 13.5)
  assert.equal(generated[1].priceValue, 36)
  assert.equal(generated[1].description, "Toque caramelizado.")
  assert.deepEqual(generated[0].images, ["/images/products/cajita-lotus.webp"])
  assert.deepEqual(generated[1].images, ["/images/products/tarta-lotus.webp"])
  assert.equal(generated[0].name, "Lotus")
})

test("una tarta del mes activa queda primera y marca los productos con badge lógico", () => {
  const generated = buildProductsFromFlavorRecords([
    {
      slug: "lotus",
      name: "Lotus",
      description: "Toque caramelizado.",
      allergens: "Leche, gluten",
      tartaImage: "/images/products/tarta-lotus.webp",
      cajitaImage: "/images/products/cajita-lotus.webp",
      tartaPrice: 36,
      cajitaPrice: 13,
      position: 0,
    },
    {
      slug: "pistacho",
      name: "Pistacho",
      description: "Pistacho 100%.",
      allergens: "Leche, frutos de cáscara",
      tartaImage: "/images/products/tarta-pistacho.webp",
      cajitaImage: "/images/products/cajita-pistacho.webp",
      tartaPrice: 39,
      cajitaPrice: 14,
      position: 1,
      isMonthlySpecial: true,
      monthlySpecialExpiresAt: "2999-05-31T21:59:00.000Z",
    },
  ])

  const flavors = generated.filter((product) => product.format === "tarta")

  assert.equal(flavors[0].category, "pistacho")
  assert.equal(flavors[0].isMonthlySpecialActive, true)
  assert.equal(flavors[0].featured, true)
})

test("una tarta del mes expirada no queda disponible para catálogo público", () => {
  const available = filterAvailableFlavorRecords([
    {
      slug: "lotus",
      name: "Lotus",
      description: "Toque caramelizado.",
      allergens: "Leche, gluten",
      tartaImage: "/images/products/tarta-lotus.webp",
      cajitaImage: "/images/products/cajita-lotus.webp",
      tartaPrice: 36,
      cajitaPrice: 13,
      position: 0,
    },
    {
      slug: "mango",
      name: "Mango",
      description: "Tropical.",
      allergens: "Leche, gluten",
      tartaImage: "/images/products/tarta-mango.webp",
      cajitaImage: "/images/products/cajita-mango.webp",
      tartaPrice: 36,
      cajitaPrice: 13,
      position: 1,
      isMonthlySpecial: true,
      monthlySpecialExpiresAt: "2020-01-31T21:59:00.000Z",
    },
  ])

  assert.deepEqual(
    available.map((record) => record.slug),
    ["lotus"]
  )
})

test("la card pública tiene borde y badge de tarta del mes", async () => {
  const source = await readFile(resolve("src/components/product-card.tsx"), "utf8")

  assert.match(source, /Tarta del mes/)
  assert.match(source, /border-2 border-accent/)
})
