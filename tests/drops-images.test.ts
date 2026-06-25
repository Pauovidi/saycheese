import assert from "node:assert/strict"
import test from "node:test"

import {
  MAX_DROP_IMAGES,
  addDropSecondaryImage,
  makeDropImagePrimary,
  moveDropSecondaryImage,
  normalizeDropImageList,
  removeDropImage,
  replaceDropPrimaryImage,
} from "../src/data/drop-images"

test("imagen principal queda en índice 0 y reemplazar conserva secundarias", () => {
  assert.deepEqual(replaceDropPrimaryImage(["/old.jpg", "/s1.jpg", "/s2.jpg"], "/new.jpg"), [
    "/new.jpg",
    "/s1.jpg",
    "/s2.jpg",
  ])
})

test("añadir secundarias conserva principal y evita duplicados", () => {
  assert.deepEqual(addDropSecondaryImage(["/main.jpg", "/s1.jpg"], "/s2.jpg"), [
    "/main.jpg",
    "/s1.jpg",
    "/s2.jpg",
  ])
  assert.deepEqual(addDropSecondaryImage(["/main.jpg", "/s1.jpg"], "/s1.jpg"), ["/main.jpg", "/s1.jpg"])
})

test("convertir secundaria en principal reordena el array", () => {
  assert.deepEqual(makeDropImagePrimary(["/main.jpg", "/s1.jpg", "/s2.jpg"], 2), [
    "/s2.jpg",
    "/main.jpg",
    "/s1.jpg",
  ])
})

test("eliminar secundaria no altera otras y reordenar respeta principal", () => {
  assert.deepEqual(removeDropImage(["/main.jpg", "/s1.jpg", "/s2.jpg"], 1), ["/main.jpg", "/s2.jpg"])
  assert.deepEqual(moveDropSecondaryImage(["/main.jpg", "/s1.jpg", "/s2.jpg"], 1, -1), [
    "/main.jpg",
    "/s2.jpg",
    "/s1.jpg",
  ])
})

test("galería respeta máximo total de imágenes", () => {
  const images = Array.from({ length: MAX_DROP_IMAGES + 2 }, (_, index) => `/image-${index}.jpg`)
  assert.equal(normalizeDropImageList(images).length, MAX_DROP_IMAGES)
  assert.equal(addDropSecondaryImage(normalizeDropImageList(images), "/extra.jpg").length, MAX_DROP_IMAGES)
})
