-- Enforce exactly one active shift across the system (ended_at is null).
create unique index if not exists shifts_single_active_guard_idx
  on public.shifts ((true))
  where ended_at is null;

-- Helper RPC for UI: returns the current active guard with display name.
create or replace function public.get_active_shift_guardian()
returns table (
  shift_id uuid,
  user_id uuid,
  started_at timestamptz,
  cashier_name text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    s.id as shift_id,
    s.user_id,
    s.started_at,
    coalesce(
      nullif(u.raw_user_meta_data->>'full_name', ''),
      split_part(coalesce(u.email, ''), '@', 1),
      'Caissier'
    ) as cashier_name
  from public.shifts s
  left join auth.users u on u.id = s.user_id
  where s.ended_at is null
  order by s.started_at asc
  limit 1;
$$;

revoke all on function public.get_active_shift_guardian() from public;
grant execute on function public.get_active_shift_guardian() to authenticated;
