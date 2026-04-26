create extension if not exists pgcrypto;

create table if not exists public.cake_flavors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text null,
  allergens text null,
  price_large numeric null check (price_large is null or price_large > 0),
  price_box numeric null check (price_box is null or price_box > 0),
  image_large_path text null,
  image_large_url text null,
  image_box_path text null,
  image_box_url text null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cake_flavors_slug_not_blank check (length(btrim(slug)) > 0),
  constraint cake_flavors_name_not_blank check (length(btrim(name)) > 0)
);

create table if not exists public.cake_flavor_revisions (
  id uuid primary key default gen_random_uuid(),
  flavor_id uuid null references public.cake_flavors(id) on delete set null,
  action text not null,
  slug text null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  actor text null,
  constraint cake_flavor_revisions_action_not_blank check (length(btrim(action)) > 0)
);

create index if not exists cake_flavors_active_order_idx
  on public.cake_flavors (is_active, deleted_at, display_order, name);

create index if not exists cake_flavor_revisions_flavor_id_idx
  on public.cake_flavor_revisions (flavor_id);

create index if not exists cake_flavor_revisions_slug_created_at_idx
  on public.cake_flavor_revisions (slug, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_cake_flavors_updated_at on public.cake_flavors;

create trigger set_cake_flavors_updated_at
before update on public.cake_flavors
for each row
execute function public.set_updated_at();

alter table public.cake_flavors enable row level security;
alter table public.cake_flavor_revisions enable row level security;
