create extension if not exists pgcrypto;

create table if not exists public.drops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  price numeric not null default 0 check (price >= 0),
  image_urls jsonb not null default '[]'::jsonb,
  colors jsonb not null default '[]'::jsonb,
  sizes jsonb not null default '[]'::jsonb,
  stock_total integer not null default 0 check (stock_total >= 0),
  launch_at timestamptz not null default '2026-06-30 23:00:00+00',
  launch_timezone text not null default 'Atlantic/Canary',
  is_active boolean not null default false,
  floating_enabled boolean not null default false,
  floating_message text not null default '',
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drops_slug_not_blank check (length(btrim(slug)) > 0),
  constraint drops_name_not_blank check (length(btrim(name)) > 0),
  constraint drops_image_urls_array check (jsonb_typeof(image_urls) = 'array'),
  constraint drops_colors_array check (jsonb_typeof(colors) = 'array'),
  constraint drops_sizes_array check (jsonb_typeof(sizes) = 'array'),
  constraint drops_floating_message_length check (char_length(floating_message) <= 600)
);

create table if not exists public.drop_reservations (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.drops(id) on delete restrict,
  quantity integer not null default 1,
  status text not null default 'active',
  idempotency_key text not null,
  customer_reference text null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz null,
  cancellation_reason text null,
  constraint drop_reservations_quantity_one check (quantity = 1),
  constraint drop_reservations_status_check check (status in ('active', 'cancelled')),
  constraint drop_reservations_idempotency_not_blank check (length(btrim(idempotency_key)) > 0),
  constraint drop_reservations_cancelled_at_check check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status = 'active' and cancelled_at is null)
  )
);

create table if not exists public.drop_revisions (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid null references public.drops(id) on delete set null,
  action text not null,
  slug text null,
  snapshot jsonb not null,
  actor text null,
  created_at timestamptz not null default now(),
  constraint drop_revisions_action_not_blank check (length(btrim(action)) > 0)
);

create unique index if not exists drop_reservations_drop_idempotency_idx
  on public.drop_reservations (drop_id, idempotency_key);

create index if not exists drop_reservations_drop_status_idx
  on public.drop_reservations (drop_id, status);

create index if not exists drops_active_launch_idx
  on public.drops (is_active, is_closed, launch_at);

create unique index if not exists drops_single_public_active_idx
  on public.drops ((true))
  where is_active = true and is_closed = false;

create index if not exists drop_revisions_drop_id_idx
  on public.drop_revisions (drop_id);

create index if not exists drop_revisions_slug_created_at_idx
  on public.drop_revisions (slug, created_at desc);

drop trigger if exists set_drops_updated_at on public.drops;

create trigger set_drops_updated_at
before update on public.drops
for each row
execute function public.set_updated_at();

alter table public.order_items
  add column if not exists drop_id uuid null references public.drops(id) on delete restrict,
  add column if not exists product_name text null,
  add column if not exists unit_price numeric null check (unit_price is null or unit_price >= 0),
  add column if not exists selected_size text null,
  add column if not exists selected_color text null;

do $$
declare
  check_constraint record;
begin
  for check_constraint in
    select conname, pg_get_constraintdef(oid) as definition
    from pg_constraint
    where conrelid = 'public.order_items'::regclass
      and contype = 'c'
  loop
    if check_constraint.definition ilike '%type%'
      and check_constraint.definition ilike '%cake%'
      and check_constraint.definition ilike '%box%' then
      execute format('alter table public.order_items drop constraint if exists %I', check_constraint.conname);
    end if;
  end loop;
end $$;

alter table public.order_items
  add constraint order_items_type_check check (type in ('cake', 'box', 'drop'));

alter table public.order_items
  add constraint order_items_drop_fields_check check (
    type <> 'drop'
    or (
      drop_id is not null
      and length(btrim(coalesce(product_name, ''))) > 0
      and unit_price is not null
      and length(btrim(coalesce(selected_size, ''))) > 0
      and length(btrim(coalesce(selected_color, ''))) > 0
    )
  );

create index if not exists order_items_drop_id_idx
  on public.order_items (drop_id)
  where drop_id is not null;

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
  v_reserved_units integer;
  v_ordered_units integer;
begin
  select drops.stock_total
    into v_stock_total
  from public.drops
  where drops.id = p_drop_id;

  if not found then
    raise exception 'drop_not_found' using errcode = 'P0002';
  end if;

  select coalesce(sum(quantity), 0)::integer
    into v_reserved_units
  from public.drop_reservations
  where drop_id = p_drop_id
    and status = 'active';

  select coalesce(sum(order_items.qty), 0)::integer
    into v_ordered_units
  from public.order_items
  join public.orders on orders.id = order_items.order_id
  where order_items.drop_id = p_drop_id
    and order_items.type = 'drop'
    and orders.status <> 'cancelled';

  stock_total := v_stock_total;
  reserved_units := v_reserved_units;
  ordered_units := v_ordered_units;
  available_stock := greatest(0, v_stock_total - v_reserved_units - v_ordered_units);
  return next;
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

  select *
    into v_existing
  from public.drop_reservations
  where drop_id = p_drop_id
    and idempotency_key = p_idempotency_key;

  if found then
    select * into v_summary from public.get_drop_stock_summary(p_drop_id);
    reservation_id := v_existing.id;
    reservation_status := v_existing.status;
    available_stock := v_summary.available_stock;
    reused_existing := true;
    return next;
    return;
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
    idempotency_key,
    customer_reference
  )
  values (
    p_drop_id,
    1,
    'active',
    p_idempotency_key,
    nullif(btrim(coalesce(p_customer_reference, '')), '')
  )
  returning id, status
  into reservation_id, reservation_status;

  available_stock := v_summary.available_stock - 1;
  reused_existing := false;
  return next;
end;
$$;

create or replace function public.cancel_drop_reservation(
  p_reservation_id uuid,
  p_reason text default null
)
returns table (
  reservation_id uuid,
  reservation_status text,
  available_stock integer,
  changed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.drop_reservations%rowtype;
  v_summary record;
begin
  select *
    into v_reservation
  from public.drop_reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  perform 1 from public.drops where id = v_reservation.drop_id for update;

  if v_reservation.status = 'cancelled' then
    select * into v_summary from public.get_drop_stock_summary(v_reservation.drop_id);
    reservation_id := v_reservation.id;
    reservation_status := v_reservation.status;
    available_stock := v_summary.available_stock;
    changed := false;
    return next;
    return;
  end if;

  update public.drop_reservations
    set status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_reservation_id
  returning *
  into v_reservation;

  select * into v_summary from public.get_drop_stock_summary(v_reservation.drop_id);
  reservation_id := v_reservation.id;
  reservation_status := v_reservation.status;
  available_stock := v_summary.available_stock;
  changed := true;
  return next;
end;
$$;

create or replace function public.create_order_with_items(
  p_user_id uuid,
  p_delivery_date date,
  p_status text,
  p_customer_name text,
  p_customer_email text,
  p_phone text,
  p_notes text,
  p_reminder_at timestamptz,
  p_reminder_status text,
  p_items jsonb
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
  v_requested integer;
  v_available integer;
  v_qty integer;
  v_size text;
  v_color text;
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
    order by 1
  loop
    select *
      into v_drop
    from public.drops
    where id = v_drop_id
    for update;

    if not found then
      raise exception 'drop_not_found' using errcode = 'P0002';
    end if;

    if not v_drop.is_active or v_drop.is_closed or now() < v_drop.launch_at then
      raise exception 'drop_not_live' using errcode = '22023';
    end if;

    select coalesce(sum((item.value ->> 'qty')::integer), 0)::integer
      into v_requested
    from jsonb_array_elements(p_items) as item(value)
    where item.value ->> 'type' = 'drop'
      and (item.value ->> 'drop_id')::uuid = v_drop_id;

    select available_stock
      into v_available
    from public.get_drop_stock_summary(v_drop_id);

    if v_requested <= 0 then
      raise exception 'invalid_drop_quantity' using errcode = '22023';
    end if;

    if v_available < v_requested then
      raise exception 'drop_sold_out' using errcode = '22023';
    end if;
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
    v_qty := (v_item ->> 'qty')::integer;

    if v_qty <= 0 then
      raise exception 'invalid_quantity' using errcode = '22023';
    end if;

    if v_item_type in ('cake', 'box') then
      insert into public.order_items (order_id, type, flavor, qty)
      values (v_order_id, v_item_type, v_item ->> 'flavor', v_qty);
    elsif v_item_type = 'drop' then
      v_drop_id := (v_item ->> 'drop_id')::uuid;
      v_size := btrim(coalesce(v_item ->> 'selected_size', ''));
      v_color := btrim(coalesce(v_item ->> 'selected_color', ''));

      select *
        into v_drop
      from public.drops
      where id = v_drop_id;

      if v_size = '' or not exists (
        select 1 from jsonb_array_elements_text(v_drop.sizes) as option(value) where option.value = v_size
      ) then
        raise exception 'invalid_drop_size' using errcode = '22023';
      end if;

      if v_color = '' or not exists (
        select 1 from jsonb_array_elements_text(v_drop.colors) as option(value) where option.value = v_color
      ) then
        raise exception 'invalid_drop_color' using errcode = '22023';
      end if;

      insert into public.order_items (
        order_id,
        type,
        flavor,
        qty,
        drop_id,
        product_name,
        unit_price,
        selected_size,
        selected_color
      )
      values (
        v_order_id,
        'drop',
        v_drop.name,
        v_qty,
        v_drop.id,
        v_drop.name,
        v_drop.price,
        v_size,
        v_color
      );
    else
      raise exception 'invalid_item_type' using errcode = '22023';
    end if;
  end loop;

  return v_order_id;
end;
$$;

alter table public.drops enable row level security;
alter table public.drop_reservations enable row level security;
alter table public.drop_revisions enable row level security;

revoke all on function public.get_drop_stock_summary(uuid) from public;
revoke all on function public.create_drop_reservation(uuid, text, text) from public;
revoke all on function public.cancel_drop_reservation(uuid, text) from public;
revoke all on function public.create_order_with_items(uuid, date, text, text, text, text, text, timestamptz, text, jsonb) from public;
