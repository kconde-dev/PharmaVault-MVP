-- Add username and created_at fields to user_roles table
-- The username field will store the display name (without @pharmavault.local domain)

alter table public.user_roles
add column if not exists username text unique not null default '',
add column if not exists created_at timestamp with time zone default now();

-- Update the RLS policy to allow admins to read all staff usernames
create policy "Admins can read all usernames"
  on public.user_roles for select
  using (
    auth.uid() in (
      select user_id from public.user_roles where role = 'administrator'
    )
  );

-- Allow admins to manage users
create policy "Admins can update user roles"
  on public.user_roles for update
  using (
    auth.uid() in (
      select user_id from public.user_roles where role = 'administrator'
    )
  );

-- Create an index on username for faster lookups
create index if not exists idx_user_roles_username on public.user_roles(username);
