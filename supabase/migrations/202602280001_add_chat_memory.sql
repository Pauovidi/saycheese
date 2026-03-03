create table if not exists public.chat_users (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('web', 'whatsapp')),
  external_id text not null,
  phone text,
  created_at timestamptz not null default now(),
  unique (channel, external_id)
);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.chat_users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_user_state (
  user_id uuid primary key references public.chat_users(id) on delete cascade,
  summary text,
  bot_paused_until timestamptz,
  last_openai_response_id text,
  updated_at timestamptz not null default now()
);

create index if not exists chat_messages_user_created_idx on public.chat_messages (user_id, created_at desc);
create index if not exists chat_user_state_paused_idx on public.chat_user_state (bot_paused_until);

create or replace function public.set_chat_user_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_chat_user_state_updated_at on public.chat_user_state;
create trigger trg_chat_user_state_updated_at
before update on public.chat_user_state
for each row execute function public.set_chat_user_state_updated_at();
