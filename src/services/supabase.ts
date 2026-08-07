import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> | null {
  if (!url || !anonKey || url.includes('your-project')) return null;
  if (!client) {
    client = createClient<Database>(url, anonKey);
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}
