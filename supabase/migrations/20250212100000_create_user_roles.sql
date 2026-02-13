-- Table des rôles utilisateur (liée à auth.users).
-- useAuth lit la colonne "role" pour le user_id courant.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null
);

alter table public.user_roles enable row level security;

create policy "Users can read own role"
  on public.user_roles for select
  using (auth.uid() = user_id);

insert into public.user_roles (user_id, role)
values ('9ce6f699-4144-4886-8424-d330fe9d89b7'::uuid, 'administrator')
on conflict (user_id) do update set role = excluded.role;
