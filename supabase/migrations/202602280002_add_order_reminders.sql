alter table public.orders
  add column if not exists reminder_at timestamptz,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists reminder_status text,
  add column if not exists reminder_error text;

create index if not exists orders_reminder_at_idx on public.orders (reminder_at);

comment on column public.orders.reminder_status is 'Reminder status: pending | sent | failed';
