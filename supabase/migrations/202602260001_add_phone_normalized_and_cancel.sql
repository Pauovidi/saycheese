alter table public.orders
  add column if not exists phone_normalized text
  generated always as (regexp_replace(coalesce(phone, ''), '\\D', '', 'g')) stored;

create index if not exists orders_phone_normalized_idx on public.orders (phone_normalized);

alter table public.orders
  add column if not exists cancelled_at timestamptz null,
  add column if not exists cancelled_reason text null;

create index if not exists orders_phone_idx on public.orders (phone);

comment on column public.orders.status is 'Order status: pending | completed | cancelled';
