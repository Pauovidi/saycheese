alter table public.orders
  add column if not exists done_at timestamptz null;

comment on column public.orders.status is 'Order status: pending | done | cancelled';
