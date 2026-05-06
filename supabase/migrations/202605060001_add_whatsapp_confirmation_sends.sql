create table if not exists public.whatsapp_confirmation_sends (
  order_id uuid primary key references public.orders(id) on delete cascade,
  channel text not null default 'web',
  to_number text not null,
  body text not null,
  status text not null default 'pending',
  twilio_sid text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists whatsapp_confirmation_sends_status_idx
  on public.whatsapp_confirmation_sends (status);

comment on table public.whatsapp_confirmation_sends is 'Idempotent outbound WhatsApp confirmation attempts for web orders.';
comment on column public.whatsapp_confirmation_sends.status is 'Status: pending | sent | failed';
