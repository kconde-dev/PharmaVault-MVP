-- Health check table for lightweight heartbeat pings
-- Used by the frontend to verify Supabase connectivity in real-time

create table if not exists public.health_check (
  id int primary key default 1,
  last_ping timestamptz default now()
);

-- Allow public read access (no auth required) 
alter table public.health_check enable row level security;

create policy "Public can read health status"
  on public.health_check for select
  using (true);

-- Insert initial row
insert into public.health_check (id, last_ping)
values (1, now())
on conflict (id) do update set last_ping = now();
