alter table public.orders
add column if not exists customer_email text;
