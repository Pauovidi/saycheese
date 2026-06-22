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
