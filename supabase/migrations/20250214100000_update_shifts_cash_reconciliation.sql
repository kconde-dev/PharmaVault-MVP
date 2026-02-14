-- Update shifts table to include cash reconciliation fields
alter table public.shifts
add column if not exists expected_cash decimal(12, 2),
add column if not exists actual_cash decimal(12, 2),
add column if not exists cash_difference decimal(12, 2),
add column if not exists closed_by uuid references auth.users(id);

-- Create index for quick lookup of shifts with cash data
create index if not exists shifts_with_cash_idx on public.shifts(user_id, ended_at desc)
where ended_at is not null and actual_cash is not null;
