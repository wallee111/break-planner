-- Settings: tell "never saved" apart from "saved as empty".
-- Before this, break_rules/coverage_rules defaulted to '[]' and role_colors
-- to '{}', so a settings row created by some other save (store feed, view
-- range) looked identical to a user deliberately deleting every rule, and
-- the app had to treat empty as "use defaults". Deleting all coverage rules
-- therefore came back after a reload.
--
-- After: unset = NULL (app uses its defaults); any saved value, including
-- an empty list, is honoured. Idempotent; deletes nothing.
alter table public.settings alter column break_rules drop default;
alter table public.settings alter column coverage_rules drop default;
alter table public.settings alter column role_colors drop default;

-- Empty role_colors was only ever the old column default (the app has
-- always ignored it and used its default roles), so mark it as unset.
-- Empty rule lists are NOT touched: those can be a deliberate save.
update public.settings set role_colors = null where role_colors = '{}'::jsonb;
