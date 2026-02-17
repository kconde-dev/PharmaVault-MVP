-- Customer credit/debt management support.

-- Extend legacy payment_method enum if it still exists.
do $$
begin
  if exists (select 1 from pg_type where typname = 'payment_method')
    and not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'payment_method'
        and e.enumlabel = 'crédit_dette'
    ) then
    alter type payment_method add value 'crédit_dette';
  end if;
end
$$;

-- Extend legacy transaction_type enum if it still exists.
do $$
begin
  if exists (select 1 from pg_type where typname = 'transaction_type')
    and not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'transaction_type'
        and e.enumlabel = 'Crédit'
    ) then
    alter type transaction_type add value 'Crédit';
  end if;
end
$$;

alter table public.transactions
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists payment_status text,
  add column if not exists payment_paid_at timestamptz,
  add column if not exists payment_paid_by uuid references auth.users(id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_payment_status_check'
  ) then
    alter table public.transactions
      add constraint transactions_payment_status_check
      check (
        payment_status is null
        or payment_status in ('Dette Totale', 'Payé')
      );
  end if;
end
$$;

create index if not exists idx_transactions_customer_credit_status
  on public.transactions (customer_name, payment_status, created_at desc);
