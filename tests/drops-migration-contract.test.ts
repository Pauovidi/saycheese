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
  assert.match(source, /where s\.drop_id = p_drop_id[\s\S]*s\.is_active = true[\s\S]*s\.archived_at is null/)
  assert.match(source, /archived_at is null/)
  assert.match(source, /drop_archived/)
  assert.match(source, /reservation_cancelled_idempotency_key/)
  assert.match(source, /drop_size_sold_out/)
  assert.match(source, /jsonb_agg/)
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
