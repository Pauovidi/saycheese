create or replace function public.normalize_phone(value text)
returns text
language sql
immutable
as $$
  select nullif(
    case
      when value is null then ''
      when regexp_replace(value, '\D', '', 'g') ~ '^0034\d{9,}$' then substr(regexp_replace(value, '\D', '', 'g'), 5)
      when regexp_replace(value, '\D', '', 'g') ~ '^34\d{9,}$' then substr(regexp_replace(value, '\D', '', 'g'), 3)
      else regexp_replace(value, '\D', '', 'g')
    end,
    ''
  )
$$;

alter table public.orders
  add column if not exists phone_normalized text;

do $$
declare
  generated_kind text;
begin
  select is_generated
    into generated_kind
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'phone_normalized';

  if generated_kind = 'ALWAYS' then
    execute 'alter table public.orders alter column phone_normalized drop expression';
  end if;
end
$$;

create or replace function public.set_order_phone_normalized()
returns trigger
language plpgsql
as $$
begin
  new.phone_normalized = public.normalize_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists trg_orders_phone_normalized on public.orders;
create trigger trg_orders_phone_normalized
before insert or update of phone on public.orders
for each row execute function public.set_order_phone_normalized();

update public.orders
set phone_normalized = public.normalize_phone(phone)
where phone_normalized is distinct from public.normalize_phone(phone);

create index if not exists orders_phone_normalized_idx on public.orders (phone_normalized);
