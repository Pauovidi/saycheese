import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

test("flotante usa texto exacto seguro, stock y CTA Preventa", async () => {
  const source = await readFile(resolve("src/components/drops/hero-drop-floating.tsx"), "utf8")

  assert.match(source, /drop\.floatingMessage/)
  assert.match(source, /drop\.preorderCtaText/)
  assert.match(source, /Quedan \$\{availableStock\} unidades/)
  assert.match(source, /visibleCta/)
  assert.match(source, /reserveDropPrelaunch/)
  assert.match(source, /HeroDropFloatingCard/)
  assert.match(source, /bg-\[rgba\(96,17,22,0\.7\)\]/)
  assert.match(source, /md:text-4xl/)
  assert.match(source, /bg-white/)
  assert.doesNotMatch(source, /border border-\[#f4eed4\]/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
})

test("flotante aparece sobre el titular del hero y no anclado abajo", async () => {
  const hero = await readFile(resolve("src/components/home/hero-section.tsx"), "utf8")
  const floating = await readFile(resolve("src/components/drops/hero-drop-floating.tsx"), "utf8")

  assert.ok(hero.indexOf("<HeroDropFloating") < hero.indexOf("<h2"))
  assert.doesNotMatch(floating, /bottom-6|bottom-8/)
  assert.match(hero, /gap-7/)
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
  assert.match(editor, /Vista previa privada/)
  assert.match(editor, /HeroDropFloatingCard/)
  assert.match(editor, /Publicar drop/)
  assert.match(editor, /Mostrar flotante de preventa/)
  assert.match(editor, /Cerrar drop manualmente/)
  assert.match(shirts, /Módulo no inicializado/)
  assert.match(shirts, /moduleReady/)
})

test("backoffice gestiona imágenes sin textarea crudo de URLs", async () => {
  const editor = await readFile(resolve("src/components/admin/drops/drop-admin-editor.tsx"), "utf8")
  const gallery = await readFile(resolve("src/components/admin/drops/drop-image-gallery-editor.tsx"), "utf8")

  assert.match(editor, /DropImageGalleryEditor/)
  assert.doesNotMatch(editor, /Una URL por línea/)
  assert.doesNotMatch(editor, /id="drop-images"/)
  assert.match(gallery, /Imagen principal/)
  assert.match(gallery, /Imágenes secundarias/)
  assert.match(gallery, /Convertir imagen secundaria/)
})

test("preview privada no llama a reserva ni modifica stock", async () => {
  const editor = await readFile(resolve("src/components/admin/drops/drop-admin-editor.tsx"), "utf8")

  assert.match(editor, /preview/)
  assert.doesNotMatch(editor, /reserveDropPrelaunch/)
  assert.doesNotMatch(editor, /setAvailableStock/)
})
