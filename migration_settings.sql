-- Create the settings table
CREATE TABLE IF NOT EXISTS public.settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    break_rules JSONB DEFAULT '[]'::jsonb,
    coverage_rules JSONB DEFAULT '[]'::jsonb,
    role_colors JSONB DEFAULT '{}'::jsonb,
    store_hours JSONB DEFAULT '[]'::jsonb,
    view_range JSONB DEFAULT '{"start": 8, "end": 20}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- MAX 1 row per user (enforced by PK)

-- Allow users to view their own settings
CREATE POLICY "Users can view own settings" 
ON public.settings FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to insert their own settings
CREATE POLICY "Users can insert own settings" 
ON public.settings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own settings
CREATE POLICY "Users can update own settings" 
ON public.settings FOR UPDATE 
USING (auth.uid() = user_id);

-- Create a handle helper to update the updated_at timestamp
create extension if not exists moddatetime schema extensions;

-- Assuming moddatetime extension is available, trigger it. 
-- If not available (sometimes on free tier), we can handle it in app or standard trigger.
-- For simplicity/robustness, I'll add a simple SQL trigger for it.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
