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

test("catalogo de drops comparte grid responsive con tartas", async () => {
  const grid = await readFile(resolve("src/components/catalog/catalog-grid.tsx"), "utf8")
  const tienda = await readFile(resolve("src/components/tienda/tienda-content.tsx"), "utf8")
  const drops = await readFile(resolve("app/(public)/drops/page.tsx"), "utf8")

  assert.match(grid, /grid grid-cols-2 gap-4 sm:gap-10 lg:grid-cols-3/)
  assert.match(tienda, /<CatalogGrid>/)
  assert.match(drops, /<CatalogGrid>/)
  assert.match(drops, /mb-12/)
  assert.doesNotMatch(drops, /md:grid-cols-2/)
  assert.doesNotMatch(drops, /mt-12 grid/)
})

test("card publica de drops sigue la composicion de producto y enlaza al detalle", async () => {
  const source = await readFile(resolve("src/components/drops/drop-card.tsx"), "utf8")

  assert.match(source, /aspect-square/)
  assert.match(source, /\(max-width: 768px\) 50vw, \(max-width: 1024px\) 50vw, 33vw/)
  assert.match(source, /drop\.name/)
  assert.match(source, /drop\.priceText/)
  assert.match(source, /stockLabel/)
  assert.match(source, /line-clamp-2 sm:text-xs sm:line-clamp-3/)
  assert.match(source, /href=\{`\/drops\/\$\{drop\.slug\}`\}/)
  assert.match(source, /Hacer pedido/)
  assert.match(source, /Agotado/)
  assert.doesNotMatch(source, /addItem/)
})

test("ficha live permite talla, color, cantidad y línea drop en carrito", async () => {
  const source = await readFile(resolve("src/components/drops/drop-product-detail.tsx"), "utf8")

  assert.match(source, /selectedSize/)
  assert.match(source, /selectedColor/)
  assert.match(source, /quantity/)
  assert.match(source, /format: "drop"/)
  assert.match(source, /dropId: drop\.id/)
  assert.match(source, /sellableNow/)
  assert.match(source, /Agotada/)
  assert.match(source, /selectedSizeSellable/)
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
  assert.match(editor, /Archivar drop/)
  assert.match(editor, /Desarchivar/)
  assert.match(editor, /Archivados/)
  assert.match(editor, /Stock por talla editable/)
  assert.match(editor, /suma del stock por talla/i)
  assert.match(shirts, /Módulo no inicializado/)
  assert.match(shirts, /moduleReady/)
})

test("preventa rota idempotency key cancelada una sola vez", async () => {
  const source = await readFile(resolve("src/components/drops/hero-drop-floating.tsx"), "utf8")

  assert.match(source, /rotateBrowserIdempotencyKey/)
  assert.match(source, /reservation_cancelled_idempotency_key/)
  assert.match(source, /reserveDropPrelaunch[\s\S]*reserveDropPrelaunch/)
})

test("chatbot integra drops antes del flujo de tartas sin pedir camisetas por WhatsApp", async () => {
  const engine = await readFile(resolve("lib/chatbot/engine.ts"), "utf8")
  const drops = await readFile(resolve("lib/chatbot/drops.ts"), "utf8")

  assert.match(engine, /buildDropsReplyIfIntent/)
  assert.ok(engine.indexOf("const dropsReply") < engine.indexOf("const orderTurn"))
  assert.match(engine, /WhatsApp no crea pedidos de camisetas/)
  assert.match(drops, /listChatbotDrops/)
  assert.match(drops, /sizeSellableNow|sellableNow/)
  assert.match(drops, /quiero\|pedir\|comprar\|encargar/)
  assert.match(drops, /camisa\|camiseta\|drop\|merch/)
  assert.match(drops, /no puedo confirmar los drops/)
  assert.doesNotMatch(drops, /createChatOrder|createOrderWithItems/)
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
