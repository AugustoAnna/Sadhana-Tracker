import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey || url.includes('your-project')) return null;
  if (!client) {
    client = createClient(url, anonKey);
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}
