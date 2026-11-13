-- Store-wide When I Work calendar feed (e.g. the store manager's
-- full-schedule link containing everyone's shifts).
-- The URL embeds a private token and lives ONLY in the database —
-- never in the repository (see .githooks/pre-commit).
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS store_feed_url text;
