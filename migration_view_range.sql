-- Add view_range column to policies table (actually settings table)
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS view_range JSONB DEFAULT '{"start": 8, "end": 20}'::jsonb;
