
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Database features will be disabled.');
}

// Helper to validate URL
const isValidUrl = (urlString) => {
    try {
        return Boolean(new URL(urlString));
    }
    catch (e) {
        return false;
    }
}

let client;

try {
    if (supabaseUrl && isValidUrl(supabaseUrl) && supabaseAnonKey) {
        client = createClient(supabaseUrl, supabaseAnonKey);
    } else {
        console.warn('Supabase URL/Key invalid or missing. Using fallback.');
        // Fallback to avoid crash, but requests will fail
        client = createClient('https://placeholder.supabase.co', 'placeholder');
    }
} catch (error) {
    console.error('Supabase Client Initialization Failed:', error);
    client = createClient('https://placeholder.supabase.co', 'placeholder');
}

export const supabase = client;
