-- Create enums for transaction type and payment method
create type transaction_type as enum ('recette', 'dépense');
create type payment_method as enum ('espèces', 'orange_money', 'assurance');

-- Table des transactions pour PharmaVault
-- Utilisé pour enregistrer les recettes (ventes) et dépenses de la pharmacie
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  amount decimal(12, 2) not null check (amount >= 0),
  description text not null,
  type transaction_type not null,
  method payment_method not null,
  status text not null default 'en_attente',
  is_approved boolean not null default false,
  insurance_name text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade,
  approved_by uuid references auth.users(id),
  approved_at timestamptz
);

alter table public.transactions enable row level security;

-- Les utilisateurs peuvent voir toutes les transactions de leurs gardes
create policy "Users can read transactions from own shifts"
  on public.transactions for select
  using (
    shift_id in (
      select id from public.shifts where user_id = auth.uid()
    )
  );

-- Les utilisateurs peuvent créer des transactions pour leurs gardes
create policy "Users can create transactions for own shifts"
  on public.transactions for insert
  with check (
    shift_id in (
      select id from public.shifts where user_id = auth.uid()
    )
    and created_by = auth.uid()
  );

-- Les administrateurs peuvent approuver les transactions
create policy "Admins can update transactions"
  on public.transactions for update
  using (
    (select role from public.user_roles where user_id = auth.uid()) = 'administrator'
  )
  with check (
    (select role from public.user_roles where user_id = auth.uid()) = 'administrator'
  );

create index if not exists transactions_shift_id_idx on public.transactions(shift_id);
create index if not exists transactions_created_by_idx on public.transactions(created_by);
create index if not exists transactions_status_idx on public.transactions(status);
create index if not exists transactions_type_idx on public.transactions(type);
create index if not exists transactions_created_at_idx on public.transactions(created_at desc);
