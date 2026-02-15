-- Track insurance debt settlement separately from approval workflow.

alter table public.transactions
  add column if not exists insurance_payment_status text,
  add column if not exists insurance_paid_at timestamptz,
  add column if not exists insurance_paid_by uuid references auth.users(id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_insurance_payment_status_check'
  ) then
    alter table public.transactions
      add constraint transactions_insurance_payment_status_check
      check (
        insurance_payment_status is null
        or insurance_payment_status in ('unpaid', 'paid')
      );
  end if;
end
$$;

update public.transactions
set insurance_payment_status = 'unpaid'
where insurance_id is not null
  and lower(coalesce(status, '')) in ('approved', 'validé')
  and insurance_payment_status is null;

create index if not exists idx_transactions_insurance_debt
  on public.transactions (insurance_id, status, insurance_payment_status);
