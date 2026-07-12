alter table public.drop_reservations
  add column if not exists customer_name text null,
  add column if not exists phone text null,
  add column if not exists selected_size text null,
  add column if not exists selected_color text null;

alter table public.drop_reservations
  drop constraint if exists drop_reservations_customer_name_length_check,
  add constraint drop_reservations_customer_name_length_check check (
    customer_name is null or char_length(btrim(customer_name)) between 3 and 160
  ),
  drop constraint if exists drop_reservations_phone_length_check,
  add constraint drop_reservations_phone_length_check check (
    phone is null or char_length(btrim(phone)) between 6 and 40
  ),
  drop constraint if exists drop_reservations_selected_size_length_check,
  add constraint drop_reservations_selected_size_length_check check (
    selected_size is null or char_length(btrim(selected_size)) between 1 and 80
  ),
  drop constraint if exists drop_reservations_selected_color_length_check,
  add constraint drop_reservations_selected_color_length_check check (
    selected_color is null or char_length(btrim(selected_color)) between 1 and 80
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
    end
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

  -- Las preventas se fabrican bajo pedido y no consumen el stock de venta normal.
  v_available := greatest(0, v_stock_total - v_ordered);

  return query
  select v_stock_total, v_reserved, v_ordered, v_available;
end;
$$;

create or replace function public.create_drop_preorder(
  p_drop_id uuid,
  p_idempotency_key text,
  p_customer_name text,
  p_phone text,
  p_selected_size text,
  p_selected_color text
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
  v_reservation public.drop_reservations%rowtype;
  v_summary record;
  v_customer_name text := btrim(coalesce(p_customer_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_size text := nullif(btrim(coalesce(p_selected_size, '')), '');
  v_color text := btrim(coalesce(p_selected_color, ''));
begin
  if length(btrim(coalesce(p_idempotency_key, ''))) < 8 then
    raise exception 'missing_idempotency_key' using errcode = '22023';
  end if;

  if char_length(v_customer_name) < 3 or char_length(v_customer_name) > 160 then
    raise exception 'invalid_preorder_customer_name' using errcode = '22023';
  end if;

  if char_length(v_phone) < 6 or char_length(v_phone) > 40 then
    raise exception 'invalid_preorder_phone' using errcode = '22023';
  end if;

  if length(v_color) = 0 then
    raise exception 'invalid_drop_color' using errcode = '22023';
  end if;

  -- Serializa las preventas del mismo drop antes de comprobar la clave idempotente.
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
    and idempotency_key = btrim(p_idempotency_key)
  for update;

  if found then
    if v_existing.status = 'cancelled' then
      raise exception 'reservation_cancelled_idempotency_key' using errcode = '22023';
    end if;

    if v_existing.customer_name is null then
      update public.drop_reservations
      set
        customer_name = v_customer_name,
        phone = v_phone,
        selected_size = v_size,
        selected_color = v_color,
        customer_reference = coalesce(customer_reference, v_customer_name)
      where id = v_existing.id
      returning * into v_existing;
    end if;

    select * into v_summary from public.get_drop_stock_summary(p_drop_id);
    return query select v_existing.id, v_existing.status, v_summary.available_stock, true;
    return;
  end if;

  if v_drop.archived_at is not null then
    raise exception 'drop_archived' using errcode = '22023';
  end if;

  if not v_drop.is_active or v_drop.is_closed or now() >= v_drop.launch_at then
    raise exception 'drop_not_prelaunch' using errcode = '22023';
  end if;

  if jsonb_array_length(v_drop.sizes) > 0 then
    if v_size is null or not exists (
      select 1
      from jsonb_array_elements_text(v_drop.sizes) as option(value)
      where lower(btrim(option.value)) = lower(v_size)
    ) then
      raise exception 'invalid_drop_size' using errcode = '22023';
    end if;
  else
    v_size := null;
  end if;

  if not exists (
    select 1
    from jsonb_array_elements_text(v_drop.colors) as option(value)
    where lower(btrim(option.value)) = lower(v_color)
  ) then
    raise exception 'invalid_drop_color' using errcode = '22023';
  end if;

  insert into public.drop_reservations (
    drop_id,
    quantity,
    status,
    idempotency_key,
    customer_reference,
    customer_name,
    phone,
    selected_size,
    selected_color
  )
  values (
    p_drop_id,
    1,
    'active',
    btrim(p_idempotency_key),
    v_customer_name,
    v_customer_name,
    v_phone,
    v_size,
    v_color
  )
  returning * into v_reservation;

  select * into v_summary from public.get_drop_stock_summary(p_drop_id);
  return query select v_reservation.id, v_reservation.status, v_summary.available_stock, false;
end;
$$;

revoke all on function public.get_drop_stock_summary(uuid) from public;
revoke all on function public.get_drop_stock_summary(uuid) from anon;
revoke all on function public.get_drop_stock_summary(uuid) from authenticated;
grant execute on function public.get_drop_stock_summary(uuid) to service_role;

revoke all on function public.create_drop_preorder(uuid, text, text, text, text, text) from public;
revoke all on function public.create_drop_preorder(uuid, text, text, text, text, text) from anon;
revoke all on function public.create_drop_preorder(uuid, text, text, text, text, text) from authenticated;
grant execute on function public.create_drop_preorder(uuid, text, text, text, text, text) to service_role;

notify pgrst, 'reload schema';
