-- Enforce professional expense approval workflow.
-- Goal: every expense submitted by cashier must be reviewed by admin.

-- 1) Ensure admin helper exists (both signatures for compatibility)
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = uid
      and ur.role = 'administrator'
  );
$$;

create or replace function public.is_admin(user_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(user_uid);
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

-- 2) Normalize transactions structure across legacy + modern schemas
alter table public.transactions
  add column if not exists status text,
  add column if not exists is_approved boolean default false,
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists submitted_by uuid references auth.users(id),
  add column if not exists rejected_by uuid references auth.users(id),
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists cashier_id uuid references auth.users(id),
  add column if not exists category text;

-- Backfill actor fields safely
update public.transactions
set submitted_by = coalesce(submitted_by, cashier_id, created_by)
where submitted_by is null;

update public.transactions
set cashier_id = coalesce(cashier_id, submitted_by, created_by)
where cashier_id is null;

-- Backfill category for better reporting
update public.transactions
set category = coalesce(category, case
  when lower(coalesce(text(type), '')) in ('income', 'recette') then 'Vente'
  else 'Dépense'
end)
where category is null;

-- Normalize statuses
update public.transactions
set status = case
  when lower(coalesce(text(type), '')) in ('expense', 'dépense')
    and (lower(coalesce(status, '')) in ('approved', 'validé') or coalesce(is_approved, false) = true)
    then 'approved'
  when lower(coalesce(text(type), '')) in ('expense', 'dépense')
    and lower(coalesce(status, '')) in ('rejected', 'rejeté')
    then 'rejected'
  when lower(coalesce(text(type), '')) in ('expense', 'dépense')
    then 'pending'
  else 'approved'
end
where status is null
   or lower(status) in ('en_attente', 'validé', 'rejeté');

alter table public.transactions
  alter column status set default 'approved';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_status_check'
  ) then
    alter table public.transactions
      add constraint transactions_status_check
      check (status in ('pending', 'approved', 'rejected'));
  end if;
end
$$;

-- 3) Trigger to enforce approval state transitions
create or replace function public.enforce_expense_approval_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Keep actor lineage populated
  if new.submitted_by is null then
    new.submitted_by := coalesce(new.cashier_id, new.created_by, auth.uid());
  end if;

  if new.cashier_id is null then
    new.cashier_id := coalesce(new.submitted_by, new.created_by, auth.uid());
  end if;

  -- Every expense starts as pending, regardless of client payload.
  if lower(coalesce(text(new.type), '')) in ('expense', 'dépense') and tg_op = 'INSERT' then
    new.status := 'pending';
    new.approved_by := null;
    new.approved_at := null;
    new.rejected_by := null;
    new.rejected_at := null;
    new.rejection_reason := null;
    if new.is_approved is not null then
      new.is_approved := false;
    end if;
  end if;

  -- Keep legacy compatibility in sync.
  if new.is_approved is not null then
    new.is_approved := (new.status = 'approved');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_expense_approval_workflow on public.transactions;
create trigger trg_enforce_expense_approval_workflow
before insert or update on public.transactions
for each row
execute function public.enforce_expense_approval_workflow();

-- 4) RLS policies for submission + admin approval
alter table public.transactions enable row level security;

drop policy if exists "Users can read transactions from own shifts" on public.transactions;
drop policy if exists "Users can create transactions for own shifts" on public.transactions;
drop policy if exists "Admins can update transactions" on public.transactions;
drop policy if exists "Users can read own transactions or admin all" on public.transactions;
drop policy if exists "Users can submit transactions" on public.transactions;
drop policy if exists "Admins can manage transaction approvals" on public.transactions;

create policy "Users can read own transactions or admin all"
  on public.transactions
  for select
  to authenticated
  using (
    public.is_admin(auth.uid())
    or coalesce(cashier_id, submitted_by, created_by) = auth.uid()
  );

create policy "Users can submit transactions"
  on public.transactions
  for insert
  to authenticated
  with check (
    coalesce(cashier_id, submitted_by, created_by) = auth.uid()
    and (
      lower(coalesce(text(type), '')) not in ('expense', 'dépense')
      or status = 'pending'
    )
  );

create policy "Admins can manage transaction approvals"
  on public.transactions
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Optional delete hardening: admins only
create policy "Admins can delete transactions"
  on public.transactions
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));
