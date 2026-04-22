import assert from "node:assert/strict"
import test from "node:test"

import {
  buildFlavorRecordsFromProducts,
  buildProductsFromFlavorRecords,
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
