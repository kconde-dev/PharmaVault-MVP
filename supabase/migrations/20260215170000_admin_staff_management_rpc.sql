-- Admin RPC helpers for staff management without recursive user_roles RLS reads.

drop function if exists public.admin_list_staff();

create or replace function public.admin_list_staff()
returns table (
  user_id uuid,
  username text,
  role text,
  created_at timestamptz,
  email text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    ur.user_id::uuid as user_id,
    coalesce(nullif(ur.username, ''), split_part(au.email::text, '@', 1), 'utilisateur')::text as username,
    ur.role::text as role,
    coalesce(ur.created_at, au.created_at, now())::timestamptz as created_at,
    coalesce(au.email::text, concat(coalesce(nullif(ur.username, ''), 'utilisateur'), '@pharmavault.com')::text)::text as email
  from public.user_roles ur
  left join auth.users au on au.id = ur.user_id
  where public.is_admin(auth.uid());
$$;

create or replace function public.admin_update_user_role(target_user_id uuid, new_role text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  updated_count integer := 0;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  if new_role not in ('administrator', 'staff') then
    raise exception 'invalid role';
  end if;

  update public.user_roles
  set role = new_role
  where user_id = target_user_id;

  get diagnostics updated_count = row_count;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
  where id = target_user_id;

  return updated_count > 0;
end;
$$;

create or replace function public.admin_delete_user_mapping(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  delete from public.user_roles
  where user_id = target_user_id;

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

revoke all on function public.admin_list_staff() from public;
revoke all on function public.admin_update_user_role(uuid, text) from public;
revoke all on function public.admin_delete_user_mapping(uuid) from public;

grant execute on function public.admin_list_staff() to authenticated;
grant execute on function public.admin_update_user_role(uuid, text) to authenticated;
grant execute on function public.admin_delete_user_mapping(uuid) to authenticated;
