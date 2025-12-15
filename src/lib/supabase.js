
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Database features will be disabled.');
    if (import.meta.env.DEV) {
        alert(`Supabase env missing. URL: ${supabaseUrl || 'none'}, Key: ${supabaseAnonKey ? 'set' : 'none'}`);
    }
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

let supabase; // Changed from 'client' to 'supabase'

try {
    if (supabaseUrl && isValidUrl(supabaseUrl) && supabaseAnonKey) {
        supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Debug helper (remove in production)
        if (typeof window !== 'undefined') {
            window.supabase = supabase;
        }
        if (import.meta.env.DEV) {
            const keyPreview = supabaseAnonKey.length > 12 ? `${supabaseAnonKey.slice(0, 12)}...` : supabaseAnonKey;
            alert(`Supabase URL in use: ${supabaseUrl.slice(0, 50)}... | Key: ${keyPreview}`);
        }
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
