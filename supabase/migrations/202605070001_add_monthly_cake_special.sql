alter table public.cake_flavors
  add column if not exists is_monthly_special boolean not null default false,
  add column if not exists monthly_special_expires_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cake_flavors_monthly_special_requires_expiry'
      and conrelid = 'public.cake_flavors'::regclass
  ) then
    alter table public.cake_flavors
      add constraint cake_flavors_monthly_special_requires_expiry
      check (not is_monthly_special or monthly_special_expires_at is not null);
  end if;
end;
$$;

create index if not exists cake_flavors_monthly_special_idx
  on public.cake_flavors (is_monthly_special, monthly_special_expires_at)
  where is_monthly_special = true;
