-- Global app settings persisted in database (singleton row).

create table if not exists public.app_settings (
  id integer primary key default 1 check (id = 1),
  pharmacy_name text not null,
  pharmacy_address text not null,
  pharmacy_phone text not null,
  pharmacy_email text not null,
  whatsapp_enabled boolean not null default true,
  whatsapp_recipient_number text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.app_settings enable row level security;

drop policy if exists "Authenticated can read app settings" on public.app_settings;
drop policy if exists "Admins can insert app settings" on public.app_settings;
drop policy if exists "Admins can update app settings" on public.app_settings;

create policy "Authenticated can read app settings"
  on public.app_settings
  for select
  to authenticated
  using (true);

create policy "Admins can insert app settings"
  on public.app_settings
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Admins can update app settings"
  on public.app_settings
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

insert into public.app_settings (
  id,
  pharmacy_name,
  pharmacy_address,
  pharmacy_phone,
  pharmacy_email,
  whatsapp_enabled,
  whatsapp_recipient_number
)
values (
  1,
  'PharmaVault Officine',
  'Conakry, Guinée',
  '+224 000 00 00 00',
  'contact@pharmavault.gn',
  true,
  '+224622000000'
)
on conflict (id) do nothing;
