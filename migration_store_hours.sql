-- Add store_hours column to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS store_hours JSONB DEFAULT '[]'::jsonb;
