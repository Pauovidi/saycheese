import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

test("migración crea drops, preventas y columnas de merchandising sin seed activo", async () => {
  const source = await readFile(resolve("supabase/migrations/202606220001_add_merch_drops.sql"), "utf8")

  assert.match(source, /create table if not exists public\.drops/)
  assert.match(source, /create table if not exists public\.drop_reservations/)
  assert.match(source, /default false/)
  assert.match(source, /add column if not exists drop_id/)
  assert.match(source, /type in \('cake', 'box', 'drop'\)/)
  assert.doesNotMatch(source, /insert into public\.drops/i)
})

test("preventa usa idempotencia, bloqueo de fila y límite temporal en servidor", async () => {
  const source = await readFile(resolve("supabase/migrations/202606220001_add_merch_drops.sql"), "utf8")

  assert.match(source, /create or replace function public\.create_drop_reservation/)
  assert.match(source, /drop_reservations_drop_idempotency_idx/)
  assert.match(source, /for update/)
  assert.match(source, /now\(\) >= v_drop\.launch_at/)
  assert.match(source, /drop_sold_out/)
})

test("pedido live se crea en una RPC transaccional con locks antes de insertar order_items", async () => {
  const source = await readFile(resolve("supabase/migrations/202606220001_add_merch_drops.sql"), "utf8")

  assert.match(source, /create or replace function public\.create_order_with_items/)
  assert.match(source, /for update/)
  assert.match(source, /now\(\) < v_drop\.launch_at/)
  assert.match(source, /insert into public\.orders[\s\S]*insert into public\.order_items/)
  assert.match(source, /orders\.status <> 'cancelled'/)
})

test("cancelar preventa es idempotente y devuelve stock una sola vez", async () => {
  const source = await readFile(resolve("supabase/migrations/202606220001_add_merch_drops.sql"), "utf8")

  assert.match(source, /create or replace function public\.cancel_drop_reservation/)
  assert.match(source, /if v_reservation\.status = 'cancelled'/)
  assert.match(source, /changed := false/)
  assert.match(source, /changed := true/)
})

test("documentación cubre despliegue de código antes de migración", async () => {
  const source = await readFile(resolve("docs/MERCH_DROPS.md"), "utf8")

  assert.match(source, /Despliegue de código antes de migración/)
  assert.match(source, /schema cache/)
  assert.match(source, /503 controlado/)
  assert.match(source, /no ejecuta migraciones remotas/i)
})

test("migración de preventa guarda datos completos sin consumir stock live", async () => {
  const source = await readFile(resolve("supabase/migrations/202607120001_preorder_details_and_stock_separation.sql"), "utf8")

  assert.match(source, /add column if not exists customer_name/)
  assert.match(source, /add column if not exists phone/)
  assert.match(source, /add column if not exists selected_size/)
  assert.match(source, /add column if not exists selected_color/)
  assert.match(source, /create or replace function public\.create_drop_preorder/)
  assert.match(source, /now\(\) >= v_drop\.launch_at/)
  assert.match(source, /jsonb_array_elements_text\(v_drop\.sizes\)/)
  assert.match(source, /jsonb_array_elements_text\(v_drop\.colors\)/)
  assert.match(source, /v_available := greatest\(0, v_stock_total - v_ordered\)/)
  assert.doesNotMatch(source, /v_stock_total - v_reserved - v_ordered/)
  assert.match(source, /grant execute on function public\.create_drop_preorder\(uuid, text, text, text, text, text\) to service_role/)
  assert.doesNotMatch(source, /insert into public\.drops/i)
})

test("migración aditiva del refinamiento añade CTA y endurece permisos RPC", async () => {
  const source = await readFile(resolve("supabase/migrations/202606250001_refine_merch_drop_admin.sql"), "utf8")

  assert.match(source, /add column if not exists preorder_cta_text text not null default 'Preventa'/)
  assert.match(source, /drops_preorder_cta_text_check/)
  assert.match(source, /char_length\(preorder_cta_text\) <= 60/)
  assert.match(source, /length\(btrim\(preorder_cta_text\)\) > 0/)
  assert.doesNotMatch(source, /insert into public\.drops/i)

  for (const fn of [
    "get_drop_stock_summary\\(uuid\\)",
    "create_drop_reservation\\(uuid, text, text\\)",
    "cancel_drop_reservation\\(uuid, text\\)",
    "create_order_with_items\\(uuid, date, text, text, text, text, text, timestamptz, text, jsonb\\)",
  ]) {
    assert.match(source, new RegExp(`revoke all on function public\\.${fn} from public`))
    assert.match(source, new RegExp(`revoke all on function public\\.${fn} from anon`))
    assert.match(source, new RegExp(`revoke all on function public\\.${fn} from authenticated`))
    assert.match(source, new RegExp(`grant execute on function public\\.${fn} to service_role`))
  }
})

test("migración aditiva de archivado y stock por talla es segura y no destructiva", async () => {
  const source = await readFile(resolve("supabase/migrations/202606260001_archive_drops_size_stock_chatbot.sql"), "utf8")

  assert.match(source, /add column if not exists archived_at/)
  assert.match(source, /add column if not exists archived_by/)
  assert.match(source, /add column if not exists archive_reason/)
  assert.match(source, /create table if not exists public\.drop_size_stock/)
  assert.match(source, /is_active boolean not null default true/)
  assert.match(source, /archived_at timestamptz null/)
  assert.match(source, /drop_size_stock_total_non_negative/)
  assert.match(source, /drop_size_stock_size_not_blank/)
  assert.match(source, /drop_size_stock_drop_position_idx/)
  const globalStockRpc = source.match(/create or replace function public\.get_drop_stock_summary[\s\S]*?\$\$/i)?.[0] ?? ""
  assert.match(
    globalStockRpc,
    /returns table \(\s*stock_total integer,\s*reserved_units integer,\s*ordered_units integer,\s*available_stock integer\s*\)/i
  )
  assert.doesNotMatch(globalStockRpc, /size_stock/i)
  assert.match(source, /create or replace function public\.get_drop_size_stock_summary\(p_drop_id uuid\)/)
  const sizeStockRpc = source.match(/create or replace function public\.get_drop_size_stock_summary[\s\S]*?\)\s*language plpgsql/i)?.[0] ?? ""
  assert.match(sizeStockRpc, /"position" integer/)
  assert.doesNotMatch(sizeStockRpc, /^\s*position integer\s*$/im)
  assert.match(source, /from public\.get_drop_size_stock_summary\(v_drop_id\) as x/)
  assert.match(source, /where s\.drop_id = p_drop_id[\s\S]*s\.is_active = true[\s\S]*s\.archived_at is null/)
  assert.match(source, /archived_at is null/)
  assert.match(source, /drop_archived/)
  assert.match(source, /reservation_cancelled_idempotency_key/)
  assert.match(source, /drop_size_sold_out/)
  assert.match(source, /sellable_now/)
  assert.match(source, /v_has_phone_normalized boolean/)
  assert.match(source, /v_phone_normalized_generated boolean/)
  assert.match(source, /attname = 'phone_normalized'/)
  assert.match(source, /regexp_replace\(coalesce\(p_phone, ''\), '\\D', '', 'g'\)/)
  assert.match(source, /coalesce\(nullif\(p_status, ''\), 'pending'\)/)
  assert.match(source, /notify pgrst, 'reload schema'/)
  assert.doesNotMatch(source, /drop_name/i)
  assert.doesNotMatch(source, /delete\s+from\s+public\.drops/i)
  assert.doesNotMatch(source, /delete\s+from\s+public\.drop_reservations/i)
  assert.doesNotMatch(source, /delete\s+from\s+public\.order_items/i)
  assert.doesNotMatch(source, /delete\s+from\s+public\.drop_size_stock/i)
  assert.doesNotMatch(source, /insert into public\.drops/i)

  for (const fn of [
    "get_drop_stock_summary\\(uuid\\)",
    "get_drop_size_stock_summary\\(uuid\\)",
    "create_drop_reservation\\(uuid, text, text\\)",
    "cancel_drop_reservation\\(uuid, text\\)",
    "create_order_with_items\\(uuid, date, text, text, text, text, text, timestamptz, text, jsonb\\)",
  ]) {
    assert.match(source, new RegExp(`revoke all on function public\\.${fn} from anon`))
    assert.match(source, new RegExp(`revoke all on function public\\.${fn} from authenticated`))
    assert.match(source, new RegExp(`grant execute on function public\\.${fn} to service_role`))
  }
})

test("store sincroniza stock por talla sin borrado masivo ni pérdida de tallas históricas", async () => {
  const source = await readFile(resolve("src/data/drops-store.ts"), "utf8")

  assert.match(source, /async function syncDropSizeStock/)
  assert.match(source, /dedupeSizeStockInput/)
  assert.match(source, /is_active: false/)
  assert.match(source, /archived_at: archivedAt/)
  assert.match(source, /is_active: true/)
  assert.match(source, /assertDropArchiveSizeStockSchemaReady/)
  assert.doesNotMatch(source, /\.from\("drop_size_stock"\)\.delete\(\)/)
  assert.doesNotMatch(source, /deleteError/)
  assert.doesNotMatch(source, /replaceDropSizeStock/)
})

test("migración aditiva de tallas opcionales mantiene contratos y permisos seguros", async () => {
  const source = await readFile(resolve("supabase/migrations/202606270001_optional_drop_sizes_and_hero_claim.sql"), "utf8")
  const globalStockRpc = source.match(/create or replace function public\.get_drop_stock_summary[\s\S]*?end;\s*\$\$;/i)?.[0] ?? ""
  const sizeStockRpc = source.match(/create or replace function public\.get_drop_size_stock_summary[\s\S]*?end;\s*\$\$;/i)?.[0] ?? ""
  const orderRpc = source.match(/create or replace function public\.create_order_with_items[\s\S]*?end;\s*\$\$;/i)?.[0] ?? ""
  const orderItemsConstraint = source.match(/add constraint order_items_drop_fields_check check \([\s\S]*?\n  \);/i)?.[0] ?? ""
  const sizeStockBackfill = source.match(/update public\.drops d[\s\S]*?set size_stock_enabled = true[\s\S]*?;/i)?.[0] ?? ""

  assert.match(source, /add column if not exists size_stock_enabled boolean not null default false/)
  assert.match(sizeStockBackfill, /coalesce\(\([\s\S]*sum\(s\.stock_total\)[\s\S]*\), 0\) > 0/i)
  assert.doesNotMatch(sizeStockBackfill, /exists\s*\(\s*select\s+1/i)
  assert.match(source, /drop constraint if exists order_items_drop_fields_check/)
  assert.doesNotMatch(orderItemsConstraint, /selected_size/)
  assert.match(
    globalStockRpc,
    /returns table \(\s*stock_total integer,\s*reserved_units integer,\s*ordered_units integer,\s*available_stock integer\s*\)/i
  )
  assert.doesNotMatch(globalStockRpc, /size_stock jsonb/i)
  assert.match(globalStockRpc, /when coalesce\(drops\.size_stock_enabled, false\)[\s\S]*sum\(s\.stock_total\)::integer/)
  assert.match(globalStockRpc, /else drops\.stock_total/)
  assert.match(sizeStockRpc, /if not v_size_stock_enabled then\s*return;/i)
  assert.match(sizeStockRpc, /s\.is_active = true[\s\S]*s\.archived_at is null/)
  assert.match(sizeStockRpc, /"position" integer/)
  assert.match(orderRpc, /if coalesce\(v_drop\.size_stock_enabled, false\) then[\s\S]*invalid_drop_size/)
  assert.match(orderRpc, /v_size := nullif\(btrim\(coalesce\(v_item ->> 'selected_size', ''\)\), ''\)/)
  assert.match(orderRpc, /v_summary\.available_stock/)
  assert.match(orderRpc, /v_has_phone_normalized boolean/)
  assert.match(source, /notify pgrst, 'reload schema'/)
  assert.doesNotMatch(source, /drop_name/i)
  assert.doesNotMatch(source, /delete\s+from\s+public\.(?:drops|drop_reservations|order_items|drop_size_stock)/i)
  assert.doesNotMatch(source, /insert into public\.drops/i)

  for (const fn of [
    "get_drop_stock_summary\\(uuid\\)",
    "get_drop_size_stock_summary\\(uuid\\)",
    "create_order_with_items\\(uuid, date, text, text, text, text, text, timestamptz, text, jsonb\\)",
  ]) {
    assert.match(source, new RegExp(`revoke all on function public\\.${fn} from anon`))
    assert.match(source, new RegExp(`revoke all on function public\\.${fn} from authenticated`))
    assert.match(source, new RegExp(`grant execute on function public\\.${fn} to service_role`))
  }
})
