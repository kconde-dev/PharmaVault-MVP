-- Client memory table for credit/debt operations.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text,
  solde_dette numeric(14,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clients_nom_unique'
  ) then
    alter table public.clients
      add constraint clients_nom_unique unique (nom);
  end if;
end
$$;

create index if not exists idx_clients_nom on public.clients (nom);
create index if not exists idx_clients_solde_dette on public.clients (solde_dette);

alter table public.clients enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clients' and policyname = 'clients_select_authenticated'
  ) then
    create policy clients_select_authenticated
      on public.clients
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clients' and policyname = 'clients_insert_authenticated'
  ) then
    create policy clients_insert_authenticated
      on public.clients
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clients' and policyname = 'clients_update_authenticated'
  ) then
    create policy clients_update_authenticated
      on public.clients
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;
