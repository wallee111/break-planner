-- Create Roster Table
create table if not exists public.roster (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  default_role text default 'Product Guide',
  user_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.roster enable row level security;

-- Policies
drop policy if exists "Users can only access their own roster" on public.roster;

create policy "Users can only access their own roster"
on public.roster for all
using (auth.uid() = user_id);
