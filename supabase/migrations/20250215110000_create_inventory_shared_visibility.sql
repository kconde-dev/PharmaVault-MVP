-- Shared inventory table for stock tracking.
-- Creates the table only if it is missing and allows shared read visibility
-- for authenticated users with role staff/administrator.

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  quantity numeric(12, 2) not null default 0 check (quantity >= 0),
  unit text not null default 'unit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory enable row level security;

grant select on table public.inventory to authenticated;

drop policy if exists "Staff and admins can view inventory" on public.inventory;
create policy "Staff and admins can view inventory"
  on public.inventory for select
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('staff', 'administrator')
    )
  );

create index if not exists inventory_name_idx on public.inventory(name);
create index if not exists inventory_sku_idx on public.inventory(sku);
