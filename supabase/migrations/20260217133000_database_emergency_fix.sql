-- Emergency schema alignment for credit + assurance + client memory.

-- 1) Clients table for debt memory/autocomplete.
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
    select 1 from pg_constraint where conname = 'clients_nom_unique'
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

-- 2) Transactions alignment for assurance split + credit metadata.
alter table public.transactions
  add column if not exists insurance_amount numeric(12,2) not null default 0,
  add column if not exists total_amount numeric(12,2),
  add column if not exists amount_paid numeric(12,2),
  add column if not exists insurance_provider text,
  add column if not exists insurance_reference text,
  add column if not exists payment_method text;

-- Drop legacy payment_method constraints first so normalization updates don't fail.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and pg_get_constraintdef(oid) ilike '%payment_method%'
  loop
    execute format('alter table public.transactions drop constraint if exists %I', c.conname);
  end loop;
end
$$;

-- If old column `method` exists, copy values into `payment_method` where empty.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'method'
  ) then
    execute $sql$
      update public.transactions
      set payment_method = coalesce(payment_method, method::text)
      where payment_method is null
    $sql$;
  end if;
end
$$;

-- Build robust payment_method value normalization.
update public.transactions
set payment_method = case
  when lower(coalesce(payment_method, '')) in ('espèces', 'especes', 'cash') then 'cash'
  when lower(coalesce(payment_method, '')) in ('orange_money', 'mobile_money', 'orange money', 'orange money (code marchand)') then 'orange_money'
  when lower(coalesce(payment_method, '')) in ('crédit_dette', 'credit_debt', 'credit', 'crédit') then 'credit'
  when lower(coalesce(payment_method, '')) in ('assurance', 'card') then 'assurance'
  else coalesce(nullif(payment_method, ''), 'cash')
end;

alter table public.transactions
  alter column payment_method set default 'cash';

update public.transactions
set payment_method = 'cash'
where payment_method is null;

alter table public.transactions
  alter column payment_method set not null;

-- Add canonical payment_method constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_payment_method_check'
  ) then
    alter table public.transactions
      add constraint transactions_payment_method_check
      check (payment_method in ('cash', 'orange_money', 'credit', 'assurance'));
  end if;
end
$$;

-- Refresh PostgREST schema cache (Supabase API layer).
notify pgrst, 'reload schema';
