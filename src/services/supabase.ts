import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// @supabase/supabase-js is pinned to an exact version in package.json (no
// caret). Sign-in depends on auth-js behaviour that has moved between minor
// releases — offline session preservation in getSession(), the anonymous →
// email conversion path, and the experimental passkey API planned next — and
// supabase-js pins its own @supabase/auth-js exactly, so pinning here pins the
// whole auth stack. Bump deliberately and re-run the auth tests.

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
