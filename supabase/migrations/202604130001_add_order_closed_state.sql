alter table public.chat_user_state
add column if not exists order_closed boolean not null default false;
