/** Read once at app start. Never derived from user input. */
export const APP_ENV = import.meta.env.VITE_APP_ENV === 'lab' ? 'lab' : 'study';

/**
 * Seconds a participant must wait before another code can be sent to the same
 * address. Must match Supabase → Authentication → Rate Limits (per-user email
 * interval, default 60); lower both together. The server is the authority —
 * if it refuses, the app shows the exact wait it asks for.
 */
export const OTP_RESEND_SECONDS = Number(import.meta.env.VITE_OTP_RESEND_SECONDS) || 60;
