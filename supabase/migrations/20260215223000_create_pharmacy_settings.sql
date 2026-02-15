-- Canonical pharmacy settings table used for app branding and infra settings.

create table if not exists public.pharmacy_settings (
  id integer primary key default 1 check (id = 1),
  business_name text not null,
  address text not null,
  phone text not null,
  email text not null,
  whatsapp_enabled boolean not null default true,
  whatsapp_recipient_number text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.pharmacy_settings
  add column if not exists business_name text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists whatsapp_enabled boolean default true,
  add column if not exists whatsapp_recipient_number text,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.pharmacy_settings enable row level security;

drop policy if exists "Authenticated can read pharmacy settings" on public.pharmacy_settings;
drop policy if exists "Admins can insert pharmacy settings" on public.pharmacy_settings;
drop policy if exists "Admins can update pharmacy settings" on public.pharmacy_settings;

create policy "Authenticated can read pharmacy settings"
  on public.pharmacy_settings
  for select
  to authenticated
  using (true);

create policy "Admins can insert pharmacy settings"
  on public.pharmacy_settings
  for insert
  to authenticated
  with check (
    public.is_admin(auth.uid())
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('admin', 'administrator')
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@pharmavault.com'
  );

create policy "Admins can update pharmacy settings"
  on public.pharmacy_settings
  for update
  to authenticated
  using (
    public.is_admin(auth.uid())
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('admin', 'administrator')
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@pharmavault.com'
  )
  with check (
    public.is_admin(auth.uid())
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('admin', 'administrator')
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@pharmavault.com'
  );

insert into public.pharmacy_settings (
  id,
  business_name,
  address,
  phone,
  email,
  whatsapp_enabled,
  whatsapp_recipient_number
)
values (
  1,
  'Pharmacie Djoma',
  'Conakry, Guinée',
  '+224 000 00 00 00',
  'contact@pharmavault.gn',
  true,
  '+224622000000'
)
on conflict (id) do nothing;

-- If legacy app_settings exists, mirror it into the new table once.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'app_settings'
  ) then
    update public.pharmacy_settings ps
    set
      business_name = coalesce((select pharmacy_name from public.app_settings where id = 1), ps.business_name),
      address = coalesce((select pharmacy_address from public.app_settings where id = 1), ps.address),
      phone = coalesce((select pharmacy_phone from public.app_settings where id = 1), ps.phone),
      email = coalesce((select pharmacy_email from public.app_settings where id = 1), ps.email),
      whatsapp_enabled = coalesce((select whatsapp_enabled from public.app_settings where id = 1), ps.whatsapp_enabled),
      whatsapp_recipient_number = coalesce((select whatsapp_recipient_number from public.app_settings where id = 1), ps.whatsapp_recipient_number),
      updated_at = now()
    where ps.id = 1;
  end if;
end
$$;
