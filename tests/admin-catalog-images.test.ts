import assert from "node:assert/strict"
import test from "node:test"

import {
  IMAGE_UPLOAD_LIMIT_BYTES,
  assertValidCatalogImage,
  buildCatalogImagePath,
} from "../lib/admin/catalog-image-utils"

test("genera una ruta estable por sabor y variante", () => {
  const path = buildCatalogImagePath({
    slug: "Mango-Maracuyá",
    variant: "tarta",
    fileName: "foto-final.webp",
    mimeType: "image/webp",
  })

  assert.match(path, /^flavors\/mango-maracuya\/tarta-\d+-[\w-]+\.webp$/)
})

test("rechaza tipos no permitidos", () => {
  const file = new File(["svg"], "vector.svg", { type: "image/svg+xml" })

  assert.throws(() => assertValidCatalogImage(file), /Solo se admiten imágenes/)
})

test("rechaza imágenes por encima del máximo", () => {
  const file = new File([new Uint8Array(IMAGE_UPLOAD_LIMIT_BYTES + 1)], "gigante.png", { type: "image/png" })

  assert.throws(() => assertValidCatalogImage(file), /supera el máximo de 5 MB/)
})
