# Supabase setup para Admin Producción

## 1) Crear proyecto y Auth
1. Crea un proyecto en Supabase.
2. En **Authentication > Providers**, activa **Email** (email/password).
3. En **Project Settings > API**, copia:
   - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2) Ejecutar SQL (Schema + RLS)
En el SQL Editor de Supabase ejecuta este bloque:

```sql
create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  delivery_date date not null,
  status text not null default 'pending',
  customer_name text null,
  phone text null,
  notes text null,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null check (type in ('cake','box')),
  flavor text not null,
  qty int not null check (qty > 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_delivery_date_idx on public.orders (delivery_date);
create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_type_idx on public.order_items (type);
create index if not exists order_items_flavor_idx on public.order_items (flavor);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "orders_select_own" on public.orders
for select using (auth.uid() = user_id);

create policy "orders_insert_own" on public.orders
for insert with check (auth.uid() = user_id);

create policy "orders_update_own" on public.orders
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "orders_delete_own" on public.orders
for delete using (auth.uid() = user_id);

create policy "order_items_select_own" on public.order_items
for select using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

create policy "order_items_insert_own" on public.order_items
for insert with check (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

create policy "order_items_update_own" on public.order_items
for update using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

create policy "order_items_delete_own" on public.order_items
for delete using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);
```

## 3) Variables de entorno
### Local
Añade en `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

### Vercel
En **Project Settings > Environment Variables**, configura las mismas dos variables para Preview/Production.

## 4) Crear usuario admin
Crear usuario desde dashboard:
1. Authentication > Users.
2. Add user (email + password).
3. Usa ese login en `/admin/login`.

## 5) Flujo de prueba
1. Arranca la app.
2. Ve a `/admin/login` e inicia sesión.
3. Entra en `/admin/produccion`.
4. Selecciona rango/tipos y pulsa **Calcular**.
5. Usa **Copiar producción** para copiar resumen de tartas/cajitas.
