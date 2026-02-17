-- Track how a shift was closed (normal flow or forced by admin).
alter table public.shifts
  add column if not exists closed_reason text default 'normal';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shifts_closed_reason_check'
  ) then
    alter table public.shifts
      add constraint shifts_closed_reason_check
      check (closed_reason in ('normal', 'forced_by_admin'));
  end if;
end$$;
