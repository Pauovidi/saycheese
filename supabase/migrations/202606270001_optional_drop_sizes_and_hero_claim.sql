alter table public.drops
  add column if not exists size_stock_enabled boolean not null default false;

update public.drops d
set size_stock_enabled = true
where size_stock_enabled = false
  and coalesce((
    select sum(s.stock_total)
    from public.drop_size_stock s
    where s.drop_id = d.id
      and s.is_active = true
      and s.archived_at is null
  ), 0) > 0;

alter table public.order_items
  drop constraint if exists order_items_drop_fields_check;

alter table public.order_items
  add constraint order_items_drop_fields_check check (
    type <> 'drop'
    or (
      drop_id is not null
      and length(btrim(coalesce(product_name, ''))) > 0
      and unit_price is not null
      and length(btrim(coalesce(selected_color, ''))) > 0
    )
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
  v_size_stock_enabled boolean;
begin
  select
    case
      when coalesce(drops.size_stock_enabled, false) then coalesce((
        select sum(s.stock_total)::integer
        from public.drop_size_stock s
        where s.drop_id = drops.id
          and s.is_active = true
          and s.archived_at is null
      ), 0)
      else drops.stock_total
    end,
    coalesce(drops.size_stock_enabled, false)
    into v_stock_total, v_size_stock_enabled
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
  "position" integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary record;
  v_size_stock_enabled boolean;
begin
  select coalesce(drops.size_stock_enabled, false)
    into v_size_stock_enabled
  from public.drops
  where drops.id = p_drop_id;

  if v_size_stock_enabled is null then
    raise exception 'drop_not_found' using errcode = 'P0002';
  end if;

  if not v_size_stock_enabled then
    return;
  end if;

  select * into v_summary from public.get_drop_stock_summary(p_drop_id);

  return query
  select
    s.size,
    s.stock_total,
    coalesce(o.ordered_units, 0)::integer as ordered_units,
    greatest(0, s.stock_total - coalesce(o.ordered_units, 0))::integer as available_raw,
    least(v_summary.available_stock, greatest(0, s.stock_total - coalesce(o.ordered_units, 0)))::integer as sellable_now,
    s.position as "position"
  from public.drop_size_stock s
  left join (
    select order_items.selected_size, coalesce(sum(order_items.qty), 0)::integer as ordered_units
    from public.order_items
    join public.orders on orders.id = order_items.order_id
    where order_items.drop_id = p_drop_id
      and order_items.type = 'drop'
      and orders.status <> 'cancelled'
      and length(btrim(coalesce(order_items.selected_size, ''))) > 0
    group by order_items.selected_size
  ) o on lower(btrim(o.selected_size)) = lower(btrim(s.size))
  where s.drop_id = p_drop_id
    and s.is_active = true
    and s.archived_at is null
  order by s.position, s.size;
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

    if coalesce(v_drop.size_stock_enabled, false) then
      if exists (
        select 1
        from jsonb_array_elements(p_items) as item(value)
        where item.value ->> 'type' = 'drop'
          and (item.value ->> 'drop_id')::uuid = v_drop_id
          and length(btrim(coalesce(item.value ->> 'selected_size', ''))) = 0
      ) then
        raise exception 'invalid_drop_size' using errcode = '22023';
      end if;

      for v_size in
        select distinct btrim(item.value ->> 'selected_size')
        from jsonb_array_elements(p_items) as item(value)
        where item.value ->> 'type' = 'drop'
          and (item.value ->> 'drop_id')::uuid = v_drop_id
      loop
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

    if v_item_type = 'drop' then
      v_drop_id := (v_item ->> 'drop_id')::uuid;
      v_drop_qty := (v_item ->> 'qty')::integer;
      v_size := nullif(btrim(coalesce(v_item ->> 'selected_size', '')), '');
      v_color := btrim(v_item ->> 'selected_color');

      select *
        into v_drop
      from public.drops
      where id = v_drop_id;

      if coalesce(v_drop.size_stock_enabled, false) and v_size is null then
        raise exception 'invalid_drop_size' using errcode = '22023';
      end if;

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

revoke all on function public.get_drop_stock_summary(uuid) from public;
revoke all on function public.get_drop_stock_summary(uuid) from anon;
revoke all on function public.get_drop_stock_summary(uuid) from authenticated;
grant execute on function public.get_drop_stock_summary(uuid) to service_role;

revoke all on function public.get_drop_size_stock_summary(uuid) from public;
revoke all on function public.get_drop_size_stock_summary(uuid) from anon;
revoke all on function public.get_drop_size_stock_summary(uuid) from authenticated;
grant execute on function public.get_drop_size_stock_summary(uuid) to service_role;

revoke all on function public.create_order_with_items(uuid, date, text, text, text, text, text, timestamptz, text, jsonb) from public;
revoke all on function public.create_order_with_items(uuid, date, text, text, text, text, text, timestamptz, text, jsonb) from anon;
revoke all on function public.create_order_with_items(uuid, date, text, text, text, text, text, timestamptz, text, jsonb) from authenticated;
grant execute on function public.create_order_with_items(uuid, date, text, text, text, text, text, timestamptz, text, jsonb) to service_role;

notify pgrst, 'reload schema';
