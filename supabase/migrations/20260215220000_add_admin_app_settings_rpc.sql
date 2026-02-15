-- Reliable admin-only settings upsert via security definer RPC.

create or replace function public.admin_upsert_app_settings(
  p_pharmacy_name text,
  p_pharmacy_address text,
  p_pharmacy_phone text,
  p_pharmacy_email text,
  p_whatsapp_enabled boolean,
  p_whatsapp_recipient_number text
)
returns public.app_settings
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_result public.app_settings%rowtype;
  v_email text := '';
  v_meta_role text := '';
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select
    lower(coalesce(au.email::text, '')),
    lower(
      coalesce(
        au.raw_user_meta_data ->> 'role',
        au.raw_app_meta_data ->> 'role',
        ''
      )
    )
  into v_email, v_meta_role
  from auth.users au
  where au.id = auth.uid();

  if not (
    public.is_admin(auth.uid())
    or v_meta_role in ('admin', 'administrator')
    or v_email = 'admin@pharmavault.com'
  ) then
    raise exception 'forbidden';
  end if;

  insert into public.app_settings (
    id,
    pharmacy_name,
    pharmacy_address,
    pharmacy_phone,
    pharmacy_email,
    whatsapp_enabled,
    whatsapp_recipient_number,
    updated_at,
    updated_by
  )
  values (
    1,
    p_pharmacy_name,
    p_pharmacy_address,
    p_pharmacy_phone,
    p_pharmacy_email,
    p_whatsapp_enabled,
    p_whatsapp_recipient_number,
    now(),
    auth.uid()
  )
  on conflict (id) do update
  set
    pharmacy_name = excluded.pharmacy_name,
    pharmacy_address = excluded.pharmacy_address,
    pharmacy_phone = excluded.pharmacy_phone,
    pharmacy_email = excluded.pharmacy_email,
    whatsapp_enabled = excluded.whatsapp_enabled,
    whatsapp_recipient_number = excluded.whatsapp_recipient_number,
    updated_at = now(),
    updated_by = auth.uid()
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_upsert_app_settings(text, text, text, text, boolean, text) from public;
grant execute on function public.admin_upsert_app_settings(text, text, text, text, boolean, text) to authenticated;
