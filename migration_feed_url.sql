-- Add When I Work calendar feed URL to roster members.
-- Each employee's feed link embeds a private token and lives ONLY in the
-- database (never in the repository — see .githooks/pre-commit).
ALTER TABLE roster ADD COLUMN IF NOT EXISTS feed_url text;
