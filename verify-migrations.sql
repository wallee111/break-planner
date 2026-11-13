-- Break Planner: full schema verification.
-- Paste into Supabase dashboard → SQL Editor → Run.
-- Prints a PASS/FAIL line for every table, column, and RLS policy that
-- schema.sql + the migration_*.sql files should have created.

DO $$
DECLARE
    c record;
    missing boolean;
BEGIN
    RAISE NOTICE '=== Break Planner migration check ===';

    FOR c IN
        SELECT * FROM (VALUES
            -- tables
            ('employees table',              'schema.sql',                 'table',  'employees', NULL::text),
            ('schedules table',             'schema.sql',                 'table',  'schedules', NULL),
            ('roster table',                'migration_roster.sql',      'table',  'roster',    NULL),
            ('settings table',              'migration_settings.sql',    'table',  'settings',  NULL),
            -- columns
            ('employees.user_id',           'migration_auth.sql',        'column', 'employees', 'user_id'),
            ('employees.avatar_color',     'migration_avatar_color.sql','column', 'employees', 'avatar_color'),
            ('schedules.user_id',          'migration_auth.sql',        'column', 'schedules', 'user_id'),
            ('roster.avatar_color',         'migration_avatar_color.sql','column', 'roster',    'avatar_color'),
            ('roster.feed_url',            'migration_feed_url.sql',    'column', 'roster',    'feed_url'),
            ('settings.store_hours',       'migration_store_hours.sql', 'column', 'settings',  'store_hours'),
            ('settings.view_range',        'migration_view_range.sql',  'column', 'settings',  'view_range'),
            ('settings.store_feed_url',    'migration_store_feed.sql',  'column', 'settings',  'store_feed_url'),
            -- RLS policies (own-data access)
            ('employees own-access policy', 'migration_auth.sql',        'policy', 'Users can only access their own employees', NULL),
            ('schedules own-access policy', 'migration_auth.sql',       'policy', 'Users can only access their own schedules', NULL),
            ('roster own-access policy',    'migration_roster.sql',      'policy', 'Users can only access their own roster',    NULL),
            ('settings own-access policy', 'migration_settings.sql',    'policy', 'Users can view own settings',               NULL)
        ) AS t(label, migration, kind, a, b)
    LOOP
        IF c.kind = 'table' THEN
            missing := NOT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = c.a
            );
        ELSIF c.kind = 'column' THEN
            missing := NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = c.a AND column_name = c.b
            );
        ELSE -- policy
            missing := NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND policyname = c.a
            );
        END IF;

        IF missing THEN
            RAISE NOTICE 'MISSING  % — apply %', c.label, c.migration;
        ELSE
            RAISE NOTICE 'OK      %', c.label;
        END IF;
    END LOOP;

    RAISE NOTICE '=== check complete ===';
END $$;
