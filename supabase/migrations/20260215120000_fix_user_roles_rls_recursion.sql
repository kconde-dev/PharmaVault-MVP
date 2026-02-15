-- Fix infinite recursion in user_roles RLS policies.
-- Root cause: policy subquery referenced public.user_roles inside RLS for public.user_roles.

-- Ensure RLS is enabled.
alter table public.user_roles enable row level security;

-- Remove potentially recursive or conflicting policies.
drop policy if exists "Users can read own role" on public.user_roles;
drop policy if exists "Admins can read all usernames" on public.user_roles;
drop policy if exists "Admins can update user roles" on public.user_roles;

-- Security definer helper to evaluate admin status without triggering recursive RLS checks.
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

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

-- User roles policies: own read access + full admin management.
create policy "Users can read own role"
  on public.user_roles
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "Admins can insert user roles"
  on public.user_roles
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Admins can update user roles"
  on public.user_roles
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Admins can delete user roles"
  on public.user_roles
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));
