alter table public.drops
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by text null,
  add column if not exists archive_reason text null;

create table if not exists public.drop_size_stock (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.drops(id) on delete restrict,
  size text not null,
  stock_total integer not null default 0,
  position integer not null default 0,
  is_active boolean not null default true,
  archived_at timestamptz null,
  archived_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drop_size_stock_size_not_blank check (length(btrim(size)) > 0),
  constraint drop_size_stock_total_non_negative check (stock_total >= 0),
  constraint drop_size_stock_position_non_negative check (position >= 0)
);

create unique index if not exists drop_size_stock_drop_size_idx
  on public.drop_size_stock (drop_id, lower(btrim(size)));

create index if not exists drop_size_stock_drop_position_idx
  on public.drop_size_stock (drop_id, position);

create index if not exists drops_public_archive_idx
  on public.drops (is_active, is_closed, archived_at, launch_at);

drop index if exists public.drops_single_public_active_idx;

create unique index if not exists drops_single_public_active_idx
  on public.drops ((true))
  where is_active = true and is_closed = false and archived_at is null;

drop trigger if exists set_drop_size_stock_updated_at on public.drop_size_stock;

create trigger set_drop_size_stock_updated_at
before update on public.drop_size_stock
for each row
execute function public.set_updated_at();

insert into public.drop_size_stock (drop_id, size, stock_total, position)
select d.id, option.value, 0, option.ordinality::integer - 1
from public.drops d
cross join lateral jsonb_array_elements_text(d.sizes) with ordinality as option(value, ordinality)
where length(btrim(option.value)) > 0
  and not exists (
    select 1
    from public.drop_size_stock existing
    where existing.drop_id = d.id
      and lower(btrim(existing.size)) = lower(btrim(option.value))
  );

create or replace function public.get_drop_stock_summary(p_drop_id uuid)
returns table (
  stock_total integer,
  reserved_units integer,
  ordered_units integer,
  available_stock integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock_total integer;
  v_reserved integer;
  v_ordered integer;
  v_available integer;
begin
  select drops.stock_total
    into v_stock_total
  from public.drops
  where drops.id = p_drop_id;

  if v_stock_total is null then
    raise exception 'drop_not_found' using errcode = 'P0002';
  end if;

  select coalesce(sum(quantity), 0)::integer
    into v_reserved
  from public.drop_reservations
  where drop_id = p_drop_id
    and status = 'active';

  select coalesce(sum(order_items.qty), 0)::integer
    into v_ordered
  from public.order_items
  join public.orders on orders.id = order_items.order_id
  where order_items.drop_id = p_drop_id
    and order_items.type = 'drop'
    and orders.status <> 'cancelled';

  v_available := greatest(0, v_stock_total - v_reserved - v_ordered);

  return query
  select
    v_stock_total,
    v_reserved,
    v_ordered,
    v_available;
end;
$$;

create or replace function public.get_drop_size_stock_summary(p_drop_id uuid)
returns table (
  size text,
  stock_total integer,
  ordered_units integer,
  available_raw integer,
  sellable_now integer,
  position integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary record;
begin
  select * into v_summary from public.get_drop_stock_summary(p_drop_id);

  return query
  select
    s.size,
    s.stock_total,
    coalesce(o.ordered_units, 0)::integer as ordered_units,
    greatest(0, s.stock_total - coalesce(o.ordered_units, 0))::integer as available_raw,
    least(v_summary.available_stock, greatest(0, s.stock_total - coalesce(o.ordered_units, 0)))::integer as sellable_now,
    s.position
  from public.drop_size_stock s
  left join (
    select order_items.selected_size, coalesce(sum(order_items.qty), 0)::integer as ordered_units
    from public.order_items
    join public.orders on orders.id = order_items.order_id
    where order_items.drop_id = p_drop_id
      and order_items.type = 'drop'
      and orders.status <> 'cancelled'
    group by order_items.selected_size
  ) o on lower(btrim(o.selected_size)) = lower(btrim(s.size))
  where s.drop_id = p_drop_id
    and s.is_active = true
    and s.archived_at is null
  order by s.position, s.size;
end;
$$;

create or replace function public.create_drop_reservation(
  p_drop_id uuid,
  p_idempotency_key text,
  p_customer_reference text default null
)
returns table (
  reservation_id uuid,
  reservation_status text,
  available_stock integer,
  reused_existing boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drop public.drops%rowtype;
  v_existing public.drop_reservations%rowtype;
  v_summary record;
begin
  if length(btrim(coalesce(p_idempotency_key, ''))) = 0 then
    raise exception 'missing_idempotency_key' using errcode = '22023';
  end if;

  select *
    into v_drop
  from public.drops
  where id = p_drop_id
  for update;

  if not found then
    raise exception 'drop_not_found' using errcode = 'P0002';
  end if;

  if v_drop.archived_at is not null then
    raise exception 'drop_archived' using errcode = '22023';
  end if;

  select *
    into v_existing
  from public.drop_reservations
  where drop_id = p_drop_id
    and idempotency_key = p_idempotency_key
  limit 1;

  if found and v_existing.status = 'active' then
    select * into v_summary from public.get_drop_stock_summary(p_drop_id);
    reservation_id := v_existing.id;
    reservation_status := v_existing.status;
    available_stock := v_summary.available_stock;
    reused_existing := true;
    return next;
    return;
  elsif found and v_existing.status = 'cancelled' then
    raise exception 'reservation_cancelled_idempotency_key' using errcode = '22023';
  end if;

  if not v_drop.is_active or v_drop.is_closed or now() >= v_drop.launch_at then
    raise exception 'drop_not_prelaunch' using errcode = '22023';
  end if;

  select * into v_summary from public.get_drop_stock_summary(p_drop_id);

  if v_summary.available_stock <= 0 then
    raise exception 'drop_sold_out' using errcode = '22023';
  end if;

  insert into public.drop_reservations (
    drop_id,
    quantity,
    status,
    customer_reference,
    idempotency_key
  )
  values (
    p_drop_id,
    1,
    'active',
    nullif(btrim(coalesce(p_customer_reference, '')), ''),
    p_idempotency_key
  )
  returning id, status
  into reservation_id, reservation_status;

  select * into v_summary from public.get_drop_stock_summary(p_drop_id);

  available_stock := v_summary.available_stock;
  reused_existing := false;
  return next;
end;
$$;

create or replace function public.create_order_with_items(
  p_user_id uuid,
  p_delivery_date date,
  p_status text,
  p_customer_name text,
  p_customer_email text default null,
  p_phone text default null,
  p_notes text default null,
  p_reminder_at timestamptz default null,
  p_reminder_status text default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_item_type text;
  v_drop public.drops%rowtype;
  v_drop_id uuid;
  v_drop_qty integer;
  v_size text;
  v_color text;
  v_global_requested integer;
  v_size_requested integer;
  v_summary record;
  v_size_row record;
  v_has_phone_normalized boolean;
  v_phone_normalized_generated boolean;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for v_drop_id in
    select distinct (item.value ->> 'drop_id')::uuid
    from jsonb_array_elements(p_items) as item(value)
    where item.value ->> 'type' = 'drop'
  loop
    select *
      into v_drop
    from public.drops
    where id = v_drop_id
    for update;

    if not found then
      raise exception 'drop_not_found' using errcode = 'P0002';
    end if;

    if v_drop.archived_at is not null then
      raise exception 'drop_archived' using errcode = '22023';
    end if;

    if not v_drop.is_active or v_drop.is_closed or now() < v_drop.launch_at then
      raise exception 'drop_not_live' using errcode = '22023';
    end if;

    select coalesce(sum((item.value ->> 'qty')::integer), 0)::integer
      into v_global_requested
    from jsonb_array_elements(p_items) as item(value)
    where item.value ->> 'type' = 'drop'
      and (item.value ->> 'drop_id')::uuid = v_drop_id;

    select * into v_summary from public.get_drop_stock_summary(v_drop_id);

    if v_global_requested <= 0 then
      raise exception 'invalid_drop_quantity' using errcode = '22023';
    end if;

    if v_global_requested > v_summary.available_stock then
      raise exception 'drop_sold_out' using errcode = '22023';
    end if;

    for v_size in
      select distinct btrim(item.value ->> 'selected_size')
      from jsonb_array_elements(p_items) as item(value)
      where item.value ->> 'type' = 'drop'
        and (item.value ->> 'drop_id')::uuid = v_drop_id
    loop
      if length(v_size) = 0 then
        raise exception 'invalid_drop_size' using errcode = '22023';
      end if;

      select coalesce(sum((item.value ->> 'qty')::integer), 0)::integer
        into v_size_requested
      from jsonb_array_elements(p_items) as item(value)
      where item.value ->> 'type' = 'drop'
        and (item.value ->> 'drop_id')::uuid = v_drop_id
        and lower(btrim(item.value ->> 'selected_size')) = lower(v_size);

      select *
        into v_size_row
      from public.get_drop_size_stock_summary(v_drop_id) as x
      where lower(btrim(x.size)) = lower(v_size);

      if not found then
        raise exception 'invalid_drop_size' using errcode = '22023';
      end if;

      if v_size_requested > v_size_row.available_raw or v_size_requested > v_size_row.sellable_now then
        raise exception 'drop_size_sold_out' using errcode = '22023';
      end if;
    end loop;
  end loop;

  select exists (
    select 1
    from pg_attribute
    where attrelid = 'public.orders'::regclass
      and attname = 'phone_normalized'
      and not attisdropped
  )
    into v_has_phone_normalized;

  select coalesce((
    select attgenerated <> ''
    from pg_attribute
    where attrelid = 'public.orders'::regclass
      and attname = 'phone_normalized'
      and not attisdropped
  ), false)
    into v_phone_normalized_generated;

  if v_has_phone_normalized and not v_phone_normalized_generated then
    insert into public.orders (
      user_id,
      delivery_date,
      status,
      customer_name,
      customer_email,
      phone,
      phone_normalized,
      notes,
      reminder_at,
      reminder_status
    )
    values (
      p_user_id,
      p_delivery_date,
      coalesce(nullif(p_status, ''), 'pending'),
      p_customer_name,
      p_customer_email,
      p_phone,
      regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'),
      p_notes,
      p_reminder_at,
      p_reminder_status
    )
    returning id into v_order_id;
  else
    insert into public.orders (
      user_id,
      delivery_date,
      status,
      customer_name,
      customer_email,
      phone,
      notes,
      reminder_at,
      reminder_status
    )
    values (
      p_user_id,
      p_delivery_date,
      coalesce(nullif(p_status, ''), 'pending'),
      p_customer_name,
      p_customer_email,
      p_phone,
      p_notes,
      p_reminder_at,
      p_reminder_status
    )
    returning id into v_order_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_type := v_item ->> 'type';

    if v_item_type = 'drop' then
      v_drop_id := (v_item ->> 'drop_id')::uuid;
      v_drop_qty := (v_item ->> 'qty')::integer;
      v_size := btrim(v_item ->> 'selected_size');
      v_color := btrim(v_item ->> 'selected_color');

      select *
        into v_drop
      from public.drops
      where id = v_drop_id;

      if not exists (
        select 1 from jsonb_array_elements_text(v_drop.colors) as option(value) where option.value = v_color
      ) then
        raise exception 'invalid_drop_color' using errcode = '22023';
      end if;

      insert into public.order_items (
        order_id,
        type,
        product_name,
        flavor,
        drop_id,
        unit_price,
        selected_size,
        selected_color,
        qty
      )
      values (
        v_order_id,
        'drop',
        v_drop.name,
        v_drop.name,
        v_drop.id,
        v_drop.price,
        v_size,
        v_color,
        v_drop_qty
      );
    else
      insert into public.order_items (
        order_id,
        type,
        flavor,
        qty
      )
      values (
        v_order_id,
        v_item_type,
        v_item ->> 'flavor',
        (v_item ->> 'qty')::integer
      );
    end if;
  end loop;

  return v_order_id;
end;
$$;

alter table public.drop_size_stock enable row level security;

revoke all on function public.get_drop_stock_summary(uuid) from public;
revoke all on function public.get_drop_stock_summary(uuid) from anon;
revoke all on function public.get_drop_stock_summary(uuid) from authenticated;
grant execute on function public.get_drop_stock_summary(uuid) to service_role;

revoke all on function public.get_drop_size_stock_summary(uuid) from public;
revoke all on function public.get_drop_size_stock_summary(uuid) from anon;
revoke all on function public.get_drop_size_stock_summary(uuid) from authenticated;
grant execute on function public.get_drop_size_stock_summary(uuid) to service_role;

revoke all on function public.create_drop_reservation(uuid, text, text) from public;
revoke all on function public.create_drop_reservation(uuid, text, text) from anon;
revoke all on function public.create_drop_reservation(uuid, text, text) from authenticated;
grant execute on function public.create_drop_reservation(uuid, text, text) to service_role;

revoke all on function public.cancel_drop_reservation(uuid, text) from public;
revoke all on function public.cancel_drop_reservation(uuid, text) from anon;
revoke all on function public.cancel_drop_reservation(uuid, text) from authenticated;
grant execute on function public.cancel_drop_reservation(uuid, text) to service_role;

revoke all on function public.create_order_with_items(uuid, date, text, text, text, text, text, timestamptz, text, jsonb) from public;
revoke all on function public.create_order_with_items(uuid, date, text, text, text, text, text, timestamptz, text, jsonb) from anon;
revoke all on function public.create_order_with_items(uuid, date, text, text, text, text, text, timestamptz, text, jsonb) from authenticated;
grant execute on function public.create_order_with_items(uuid, date, text, text, text, text, text, timestamptz, text, jsonb) to service_role;

notify pgrst, 'reload schema';
