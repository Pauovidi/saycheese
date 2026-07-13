import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

test("flotante usa texto exacto seguro y enlaza la preventa a la ficha", async () => {
  const source = await readFile(resolve("src/components/drops/hero-drop-floating.tsx"), "utf8")

  assert.match(source, /drop\.floatingMessage/)
  assert.match(source, /drop\.preorderCtaText/)
  assert.match(source, /Preventa bajo pedido/)
  assert.match(source, /visibleCta/)
  assert.match(source, /href=\{`\/drops\/\$\{drop\.slug\}`\}/)
  assert.doesNotMatch(source, /reserveDropPrelaunch/)
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

test("contador del hero hidrata desde una referencia temporal estable del servidor", async () => {
  const page = await readFile(resolve("app/(public)/page.tsx"), "utf8")
  const floating = await readFile(resolve("src/components/drops/hero-drop-floating.tsx"), "utf8")

  assert.match(page, /initialNow: now\.toISOString\(\)/)
  assert.match(floating, /new Date\(drop\.initialNow\)\.getTime\(\)/)
  assert.doesNotMatch(floating, /useState\(\(\) => new Date\(drop\.launchAt\)\.getTime\(\) - Date\.now\(\)\)/)
})

test("preventa recoge cliente, teléfono, talla y color en la ficha sin carrito", async () => {
  const source = await readFile(resolve("src/components/drops/drop-product-detail.tsx"), "utf8")

  assert.match(source, /customerName/)
  assert.match(source, /phone/)
  assert.match(source, /selectedSize/)
  assert.match(source, /selectedColor/)
  assert.match(source, /reserveDropPrelaunch/)
  assert.match(source, /isPreorder \?/)
  assert.match(source, /La preventa se fabrica bajo pedido y no consume el stock/)
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

test("ficha live soporta drops con y sin tallas y no muestra conteos en botones", async () => {
  const source = await readFile(resolve("src/components/drops/drop-product-detail.tsx"), "utf8")

  assert.match(source, /usesSizeStock/)
  assert.match(source, /selectedSize/)
  assert.match(source, /selectedColor/)
  assert.match(source, /quantity/)
  assert.match(source, /format: "drop"/)
  assert.match(source, /dropId: drop\.id/)
  assert.match(source, /sellableNow/)
  assert.match(source, /agotada/i)
  assert.match(source, /selectedSellable/)
  assert.match(source, /usesSizeStock \? selectedSize : undefined/)
  assert.doesNotMatch(source, /\{stock\?\.sellableNow\}/)
  assert.doesNotMatch(source, /quedan \$\{stock\?\.sellableNow/)
})

test("carrito y checkout omiten talla cuando el drop se vende sin talla", async () => {
  const drawer = await readFile(resolve("src/components/cart-drawer.tsx"), "utf8")
  const checkout = await readFile(resolve("src/components/checkout-summary.tsx"), "utf8")
  const api = await readFile(resolve("app/api/orders/route.ts"), "utf8")

  assert.match(drawer, /\[item\.product\.selectedSize, item\.product\.selectedColor\]\.filter\(Boolean\)/)
  assert.match(checkout, /selected_size: item\.product\.selectedSize \?\? null/)
  assert.match(checkout, /\[item\.product\.selectedSize, item\.product\.selectedColor\]\.filter\(Boolean\)/)
  assert.match(api, /selected_size: z\.string\(\)\.min\(1\)\.optional\(\)\.nullable\(\)/)
})

test("backoffice expone Drops y Camisetas con preventas y pedidos separados", async () => {
  const nav = await readFile(resolve("src/components/admin/admin-nav.tsx"), "utf8")
  const editor = await readFile(resolve("src/components/admin/drops/drop-admin-editor.tsx"), "utf8")
  const shirts = await readFile(resolve("src/components/admin/drops/shirts-admin.tsx"), "utf8")
  const actions = await readFile(resolve("actions/drops.ts"), "utf8")

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
  assert.match(editor, /Usar tallas y stock por talla/)
  assert.match(editor, /El stock total se calcula automáticamente sumando las tallas activas/)
  assert.match(editor, /no afectan al stock de la venta normal/)
  assert.doesNotMatch(editor, /La suma del stock por talla debe coincidir/)
  assert.match(actions, /sizeStockEnabled/)
  assert.match(actions, /Antes de activar un drop debes configurar al menos un color/)
  assert.match(actions, /Antes de publicar con tallas debes configurar al menos una talla con stock/)
  assert.doesNotMatch(actions, /Antes de activar un drop debes configurar al menos una talla y un color/)
  assert.doesNotMatch(actions, /La suma del stock por talla debe coincidir/)
  assert.match(shirts, /Módulo no inicializado/)
  assert.match(shirts, /moduleReady/)
})

test("preventa rota idempotency key cancelada una sola vez", async () => {
  const source = await readFile(resolve("src/components/drops/drop-product-detail.tsx"), "utf8")

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
