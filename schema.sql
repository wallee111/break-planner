-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Employees Table
create table public.employees (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  roles text[] default '{}',
  start_time text default '08:00',
  end_time text default '17:00',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Schedules Table
create table public.schedules (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  schedule_data jsonb not null default '[]',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Note: We are storing the schedule structure as JSONB for the MVP to enable rapid iteration.
-- In a future phase, we can normalize breaks into their own table.

-- Enable Row Level Security (Simple open access for MVP, restrict in Prod)
alter table public.employees enable row level security;
alter table public.schedules enable row level security;

create policy "Public employees access"
on public.employees for all using (true);

create policy "Public schedules access"
on public.schedules for all using (true);
