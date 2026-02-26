# Supabase setup para Admin + Checkout

## 1) Crear proyecto y Auth
1. Crea un proyecto en Supabase.
2. En **Authentication > Providers**, activa **Email** (email/password).
3. Crea un único usuario admin en **Authentication > Users**.
4. (Recomendado) desactiva los signups públicos para mantener single-admin.

## 2) Variables de entorno
### Local (`.env.local`)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ADMIN_EMAIL=admin@dominio.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tu-cuenta@gmail.com
SMTP_PASS=<app-password-de-16-caracteres>
SMTP_FROM="SayCheese <tu-cuenta@gmail.com>"
```

### Vercel
Configura estas variables en **Project Settings > Environment Variables**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo server)
- `ADMIN_EMAIL`
- `SMTP_HOST` (recomendado: `smtp.gmail.com`)
- `SMTP_PORT` (`465` o `587`)
- `SMTP_SECURE` (`true` para 465, `false` para 587)
- `SMTP_USER`
- `SMTP_PASS` (App Password, no la contraseña normal)
- `SMTP_FROM`

> Nota: en Vercel no uses puerto 25 para SMTP. Usa 465/587.

## 3) Gmail App Password (recomendado)
Para usar Gmail SMTP de forma segura:
1. Activa la verificación en 2 pasos (2FA) en tu cuenta de Google.
2. Ve a **Cuenta de Google > Seguridad > Contraseñas de aplicaciones**.
3. Crea una contraseña de app nueva para "Mail".
4. Copia los 16 caracteres y pégalos en `SMTP_PASS`.

## 4) SQL base (schema + RLS)
Ejecuta este bloque en SQL Editor:

```sql
create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  delivery_date date not null,
  status text not null default 'pending',
  customer_name text null,
  customer_email text null,
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
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

create policy "order_items_insert_own" on public.order_items
for insert with check (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

create policy "order_items_update_own" on public.order_items
for update using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

create policy "order_items_delete_own" on public.order_items
for delete using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);
```

## 5) Migración incremental (si ya existe `orders`)
Si tu tabla `orders` ya estaba creada, ejecuta:

```sql
alter table public.orders
add column if not exists customer_email text;
```

## 6) Flujo de prueba
1. Añade productos al carrito.
2. Ve a `/checkout`, completa email, teléfono y (opcionalmente) fecha.
3. Pulsa **Confirmar pedido** (crea `orders` + `order_items` vía API server con service role).
4. Recibirás email de confirmación con fecha final programada.
5. Inicia sesión en `/admin/login` con `ADMIN_EMAIL`.
6. Abre `/admin/produccion` y revisa producción + listado de pedidos.


## 7) Migración para anulación de pedidos y búsqueda por teléfono
Aplica la migración `supabase/migrations/202602240001_add_cancel_fields_and_phone_index.sql` para:
- Añadir `cancelled_at` y `cancelled_reason` en `orders`.
- Indexar `orders.phone` para acelerar búsqueda en admin.
- Documentar estados incluyendo `cancelled` en `orders.status`.

