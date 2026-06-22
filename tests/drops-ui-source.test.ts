import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

test("flotante usa texto exacto seguro, stock y CTA Preventa", async () => {
  const source = await readFile(resolve("src/components/drops/hero-drop-floating.tsx"), "utf8")

  assert.match(source, /drop\.floatingMessage/)
  assert.match(source, /Quedan \$\{availableStock\} unidades/)
  assert.match(source, /Preventa/)
  assert.match(source, /reserveDropPrelaunch/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
})

test("preventa no muestra talla, color, cantidad ni checkout normal", async () => {
  const source = await readFile(resolve("src/components/drops/hero-drop-floating.tsx"), "utf8")

  assert.doesNotMatch(source, /selectedSize|selectedColor|quantity|checkout/i)
})

test("Drops aparece en navegación solo si el servidor lo habilita", async () => {
  const layout = await readFile(resolve("app/(public)/layout.tsx"), "utf8")
  const header = await readFile(resolve("src/components/site-header.tsx"), "utf8")

  assert.match(layout, /hasPublicDropsNav/)
  assert.match(header, /showDropsLink/)
  assert.match(header, /\/drops/)
})

test("ficha live permite talla, color, cantidad y línea drop en carrito", async () => {
  const source = await readFile(resolve("src/components/drops/drop-product-detail.tsx"), "utf8")

  assert.match(source, /selectedSize/)
  assert.match(source, /selectedColor/)
  assert.match(source, /quantity/)
  assert.match(source, /format: "drop"/)
  assert.match(source, /dropId: drop\.id/)
})

test("backoffice expone Drops y Camisetas con preventas y pedidos separados", async () => {
  const nav = await readFile(resolve("src/components/admin/admin-nav.tsx"), "utf8")
  const editor = await readFile(resolve("src/components/admin/drops/drop-admin-editor.tsx"), "utf8")
  const shirts = await readFile(resolve("src/components/admin/drops/shirts-admin.tsx"), "utf8")

  assert.match(nav, /\/admin\/drops/)
  assert.match(nav, /\/admin\/camisetas/)
  assert.match(shirts, /Preventas/)
  assert.match(shirts, /Pedidos/)
  assert.match(shirts, /cancelDropReservationFromAdmin/)
  assert.match(editor, /Módulo no inicializado/)
  assert.match(editor, /moduleReady/)
  assert.match(shirts, /Módulo no inicializado/)
  assert.match(shirts, /moduleReady/)
})
