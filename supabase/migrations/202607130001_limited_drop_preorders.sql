alter table public.drops
  add column if not exists preorder_limit integer not null default 30;

alter table public.drops
  drop constraint if exists drops_preorder_limit_non_negative,
  add constraint drops_preorder_limit_non_negative check (
    preorder_limit between 0 and 1000000
  );

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
  v_active_preorders integer;
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

  -- El lock del drop serializa el contador: dos reservas simultáneas no pueden consumir la última plaza.
  select * into v_drop
  from public.drops
  where id = p_drop_id
  for update;

  if not found then
    raise exception 'drop_not_found' using errcode = 'P0002';
  end if;

  select * into v_existing
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

  select coalesce(sum(quantity), 0)::integer into v_active_preorders
  from public.drop_reservations
  where drop_id = p_drop_id
    and status = 'active';

  if v_active_preorders >= v_drop.preorder_limit then
    raise exception 'preorder_sold_out' using errcode = '22023';
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
    drop_id, quantity, status, idempotency_key, customer_reference,
    customer_name, phone, selected_size, selected_color
  ) values (
    p_drop_id, 1, 'active', btrim(p_idempotency_key), v_customer_name,
    v_customer_name, v_phone, v_size, v_color
  )
  returning * into v_reservation;

  select * into v_summary from public.get_drop_stock_summary(p_drop_id);
  return query select v_reservation.id, v_reservation.status, v_summary.available_stock, false;
end;
$$;

revoke all on function public.create_drop_preorder(uuid, text, text, text, text, text) from public;
revoke all on function public.create_drop_preorder(uuid, text, text, text, text, text) from anon;
revoke all on function public.create_drop_preorder(uuid, text, text, text, text, text) from authenticated;
grant execute on function public.create_drop_preorder(uuid, text, text, text, text, text) to service_role;

notify pgrst, 'reload schema';
