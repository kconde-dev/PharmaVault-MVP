-- Allow app_settings writes for admins resolved from either user_roles or JWT claims.

drop policy if exists "Admins can insert app settings" on public.app_settings;
drop policy if exists "Admins can update app settings" on public.app_settings;

create policy "Admins can insert app settings"
  on public.app_settings
  for insert
  to authenticated
  with check (
    public.is_admin(auth.uid())
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('admin', 'administrator')
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@pharmavault.com'
  );

create policy "Admins can update app settings"
  on public.app_settings
  for update
  to authenticated
  using (
    public.is_admin(auth.uid())
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('admin', 'administrator')
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@pharmavault.com'
  )
  with check (
    public.is_admin(auth.uid())
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('admin', 'administrator')
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@pharmavault.com'
  );
