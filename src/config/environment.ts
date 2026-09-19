/** Read once at app start. Never derived from user input. */
export const APP_ENV = import.meta.env.VITE_APP_ENV === 'lab' ? 'lab' : 'study';

/**
 * When false (default) the app works exactly as the anonymous build did: a
 * new install gets an anonymous Supabase session and email sign-in is only
 * offered as "keep your progress". When true, every participant must sign in
 * with an email code before the app opens and anonymous sessions are asked to
 * link an email. Flip it once code emails are known to deliver.
 */
export const REQUIRE_EMAIL_SIGN_IN = import.meta.env.VITE_REQUIRE_EMAIL_SIGN_IN === 'true';
