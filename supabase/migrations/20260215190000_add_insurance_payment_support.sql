-- Insurance payment support for cash entry form.

create table if not exists public.insurances (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.insurances enable row level security;

drop policy if exists "Authenticated can read insurances" on public.insurances;
create policy "Authenticated can read insurances"
  on public.insurances
  for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage insurances" on public.insurances;
create policy "Admins can manage insurances"
  on public.insurances
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

alter table public.transactions
  add column if not exists insurance_id uuid references public.insurances(id),
  add column if not exists insurance_card_id text,
  add column if not exists coverage_percent numeric(5,2),
  add column if not exists amount_covered_by_insurance numeric(12,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_coverage_percent_range_check'
  ) then
    alter table public.transactions
      add constraint transactions_coverage_percent_range_check
      check (coverage_percent is null or (coverage_percent >= 0 and coverage_percent <= 100));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_amount_covered_non_negative_check'
  ) then
    alter table public.transactions
      add constraint transactions_amount_covered_non_negative_check
      check (amount_covered_by_insurance is null or amount_covered_by_insurance >= 0);
  end if;
end
$$;

insert into public.insurances (name)
values
  ('NSIA'),
  ('SAHAM'),
  ('LANALA')
on conflict (name) do nothing;
