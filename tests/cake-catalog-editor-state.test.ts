import assert from "node:assert/strict"
import test from "node:test"

import { NEW_FLAVOR_KEY, resolveEditorSelection } from "../src/components/admin/cake-catalog-editor-state"

test("selecciona de inmediato el sabor recién creado usando el slug canónico guardado", () => {
  const flavors = [
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
      tartaImage: "",
      cajitaImage: "",
      tartaPrice: 39,
      cajitaPrice: 14,
      position: 1,
    },
  ]

  const selection = resolveEditorSelection(flavors, "queso-azul-miel")

  assert.equal(selection.selectedSlug, "queso-azul-miel")
  assert.equal(selection.selectedFlavor?.name, "Queso azul con miel")
})

test("mantiene un fallback seguro cuando no existe el slug preferido", () => {
  const selection = resolveEditorSelection([], "inexistente")

  assert.equal(selection.selectedSlug, NEW_FLAVOR_KEY)
  assert.equal(selection.selectedFlavor, undefined)
})
