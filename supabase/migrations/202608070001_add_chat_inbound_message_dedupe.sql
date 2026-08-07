create table if not exists public.chat_inbound_messages (
  message_sid text primary key,
  received_at timestamptz not null default now()
);

create index if not exists chat_inbound_messages_received_at_idx
  on public.chat_inbound_messages (received_at desc);

alter table public.chat_inbound_messages enable row level security;
