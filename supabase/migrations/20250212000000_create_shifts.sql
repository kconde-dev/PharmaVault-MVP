-- Table des gardes (shifts) pour PharmaVault
-- Exécuter dans l’éditeur SQL Supabase si la table n’existe pas.

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.shifts enable row level security;

create policy "Users can read own shifts"
  on public.shifts for select
  using (auth.uid() = user_id);

create policy "Users can insert own shifts"
  on public.shifts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own shifts"
  on public.shifts for update
  using (auth.uid() = user_id);

create index if not exists shifts_user_id_idx on public.shifts(user_id);
create index if not exists shifts_started_at_idx on public.shifts(started_at desc);
