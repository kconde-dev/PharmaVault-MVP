-- Assurance core integration fields for transaction accounting.
alter table public.transactions
  add column if not exists total_amount numeric(12,2),
  add column if not exists amount_paid numeric(12,2),
  add column if not exists insurance_amount numeric(12,2),
  add column if not exists insurance_provider text,
  add column if not exists insurance_reference text;

-- Backfill from existing model to keep historical continuity.
update public.transactions
set
  total_amount = coalesce(total_amount, amount),
  insurance_amount = coalesce(insurance_amount, amount_covered_by_insurance, 0),
  amount_paid = coalesce(amount_paid, amount - coalesce(amount_covered_by_insurance, 0)),
  insurance_provider = coalesce(insurance_provider, insurance_name),
  insurance_reference = coalesce(insurance_reference, insurance_card_id)
where
  lower(coalesce(type, '')) in ('recette', 'income')
  and (
    insurance_name is not null
    or insurance_card_id is not null
    or amount_covered_by_insurance is not null
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_total_amount_check'
  ) then
    alter table public.transactions
      add constraint transactions_total_amount_check
      check (total_amount is null or total_amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_amount_paid_check'
  ) then
    alter table public.transactions
      add constraint transactions_amount_paid_check
      check (amount_paid is null or amount_paid >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_insurance_amount_check_v2'
  ) then
    alter table public.transactions
      add constraint transactions_insurance_amount_check_v2
      check (insurance_amount is null or insurance_amount >= 0);
  end if;
end$$;

create index if not exists idx_transactions_insurance_provider_reference
  on public.transactions (insurance_provider, insurance_reference, created_at desc);
