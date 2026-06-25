alter table public.drops
  add column if not exists preorder_cta_text text not null default 'Preventa';

alter table public.drops
  drop constraint if exists drops_preorder_cta_text_check;

alter table public.drops
  add constraint drops_preorder_cta_text_check check (
    length(btrim(preorder_cta_text)) > 0
    and char_length(preorder_cta_text) <= 60
  );

revoke all on function public.get_drop_stock_summary(uuid) from public;
revoke all on function public.get_drop_stock_summary(uuid) from anon;
revoke all on function public.get_drop_stock_summary(uuid) from authenticated;
grant execute on function public.get_drop_stock_summary(uuid) to service_role;

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
