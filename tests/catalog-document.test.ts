import assert from "node:assert/strict"
import test from "node:test"

import { buildCatalogDocument, parseCatalogDocument } from "../src/data/catalog-document"

test("normaliza el shape persistido de un sabor nuevo para el catálogo editable", () => {
  const document = buildCatalogDocument(
    [
      {
        slug: "queso-azul-miel",
        name: "Queso azul con miel",
        description: "Intenso y equilibrado.",
        allergens: "Leche, gluten",
        tartaImage: "https://cdn.example.com/tarta.webp",
        cajitaImage: "https://cdn.example.com/cajita.webp",
        tartaPrice: 39,
        cajitaPrice: 14,
        position: 7,
        createdAt: "2026-04-22T15:00:00.000Z",
        updatedAt: "2026-04-22T15:00:00.000Z",
      },
      {
        slug: "lotus",
        name: "Lotus",
        description: "Caramelizado.",
        allergens: "Leche, gluten",
        tartaImage: "/images/products/tarta-lotus.webp",
        cajitaImage: "/images/products/cajita-lotus.webp",
        tartaPrice: 36,
        cajitaPrice: 13,
        position: 2,
      },
    ],
    "2026-04-22T15:30:00.000Z"
  )

  assert.deepEqual(document, {
    version: 1,
    updatedAt: "2026-04-22T15:30:00.000Z",
    flavors: [
      {
        slug: "lotus",
        name: "Lotus",
        description: "Caramelizado.",
        allergens: "Leche, gluten",
        tartaImage: "/images/products/tarta-lotus.webp",
        cajitaImage: "/images/products/cajita-lotus.webp",
        tartaPrice: 36,
        cajitaPrice: 13,
        position: 0,
      },
      {
        slug: "queso-azul-miel",
        name: "Queso azul con miel",
        description: "Intenso y equilibrado.",
        allergens: "Leche, gluten",
        tartaImage: "https://cdn.example.com/tarta.webp",
        cajitaImage: "https://cdn.example.com/cajita.webp",
        tartaPrice: 39,
        cajitaPrice: 14,
        position: 1,
        createdAt: "2026-04-22T15:00:00.000Z",
        updatedAt: "2026-04-22T15:00:00.000Z",
      },
    ],
  })
})

test("parsea el documento persistido y descarta payloads vacíos o inválidos", () => {
  const valid = parseCatalogDocument(
    JSON.stringify({
      version: 1,
      updatedAt: "2026-04-22T15:30:00.000Z",
      flavors: [
        {
          slug: "lotus",
          name: "Lotus",
          description: "",
          allergens: "",
          tartaImage: "",
          cajitaImage: "",
          tartaPrice: 36,
          cajitaPrice: 13,
          position: 4,
        },
      ],
    })
  )

  assert.equal(valid?.flavors[0]?.slug, "lotus")
  assert.equal(valid?.flavors[0]?.position, 0)
  assert.equal(parseCatalogDocument("{"), null)
  assert.equal(parseCatalogDocument(JSON.stringify({ version: 1, updatedAt: "2026-04-22T15:30:00.000Z", flavors: [] })), null)
})
