import { getSupabase } from './supabase';

let authReady: Promise<string | null> | null = null;

/** Anonymous sign-in on first launch. Returns auth user id. */
export async function ensureAnonymousAuth(): Promise<string | null> {
  if (authReady) return authReady;

  authReady = (async () => {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user.id) {
      return sessionData.session.user.id;
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      console.error('Anonymous auth failed:', error?.message);
      return null;
    }
    return data.user.id;
  })();

  return authReady;
}

export function resetAuthCache() {
  authReady = null;
}
