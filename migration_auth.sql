-- 1. Add user_id column to tables
alter table public.employees add column user_id uuid references auth.users(id);
alter table public.schedules add column user_id uuid references auth.users(id);

-- 2. Update RLS Policies
-- Employees
drop policy "Public employees access" on public.employees;

create policy "Users can only access their own employees"
on public.employees for all
using (auth.uid() = user_id);

-- Schedules
drop policy "Public schedules access" on public.schedules;

create policy "Users can only access their own schedules"
on public.schedules for all
using (auth.uid() = user_id);
