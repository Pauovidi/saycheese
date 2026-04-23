import assert from "node:assert/strict"
import test from "node:test"

import { resolveEditorSelection } from "../src/components/admin/cake-catalog-editor-state"
import { buildCatalogDocument, parseCatalogDocument } from "../src/data/catalog-document"
import {
  buildProductsFromFlavorRecords,
  getFlavorsFromProducts,
  getProductBySlugFromProducts,
  slugifyFlavorName,
  type EditableFlavorRecord,
} from "../src/data/products"

test("alta nueva: el sabor queda editable y visible en el catálogo público", () => {
  const current: EditableFlavorRecord[] = [
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
  ]

  const name = "Queso azul con miel"
  const slug = slugifyFlavorName(name)
  const createdAt = "2026-04-22T16:00:00.000Z"

  const next = [
    ...current,
    {
      slug,
      name,
      description: "Intenso y equilibrado.",
      allergens: "Leche, gluten",
      tartaImage: "https://cdn.example.com/tarta-queso-azul-miel.webp",
      cajitaImage: "https://cdn.example.com/cajita-queso-azul-miel.webp",
      tartaPrice: 39,
      cajitaPrice: 14,
      position: current.length,
      createdAt,
      updatedAt: createdAt,
    },
  ]

  const persisted = parseCatalogDocument(JSON.stringify(buildCatalogDocument(next, "2026-04-22T16:05:00.000Z")))
  assert.ok(persisted)

  const editorSelection = resolveEditorSelection(persisted.flavors, slug)
  assert.equal(editorSelection.selectedSlug, slug)
  assert.equal(editorSelection.selectedFlavor?.name, name)

  const publicProducts = buildProductsFromFlavorRecords(persisted.flavors)
  const publicFlavors = getFlavorsFromProducts(publicProducts)
  const publicFlavor = publicFlavors.find((flavor) => flavor.category === slug)

  assert.ok(publicFlavor)
  assert.equal(publicFlavor?.tarta?.slug, `tarta-${slug}`)
  assert.equal(publicFlavor?.cajita?.slug, `cajita-${slug}`)
  assert.equal(getProductBySlugFromProducts(publicProducts, `tarta-${slug}`)?.name, name)
  assert.equal(getProductBySlugFromProducts(publicProducts, `tarta-${slug}`)?.description, "Intenso y equilibrado.")
})
