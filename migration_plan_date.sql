-- Per-date daily schedules.
-- Additive and idempotent: safe to run more than once, deletes nothing.
--
-- 1. employees.plan_date: which calendar day a team row belongs to.
--    Existing rows (which had no date) are assigned to the date of that
--    user's most recently saved schedule, so the plan they were last
--    working on keeps its team.
alter table public.employees add column if not exists plan_date date;

update public.employees e
set plan_date = coalesce(
    (select s.date from public.schedules s
      where s.user_id = e.user_id
      order by s.created_at desc
      limit 1),
    (e.created_at at time zone 'America/Toronto')::date
)
where e.plan_date is null;

create index if not exists employees_user_plan_date_idx
    on public.employees (user_id, plan_date);

-- 2. schedules.updated_at: the app now keeps ONE row per (user, date) and
--    updates it in place instead of inserting a new row on every change.
--    Older duplicate rows are left as-is; the newest by updated_at wins.
alter table public.schedules add column if not exists updated_at timestamptz;

update public.schedules set updated_at = created_at where updated_at is null;

alter table public.schedules alter column updated_at set default now();

create index if not exists schedules_user_date_updated_idx
    on public.schedules (user_id, date, updated_at desc);
