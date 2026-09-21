/** Read once at app start. Never derived from user input. */
export const APP_ENV = import.meta.env.VITE_APP_ENV === 'lab' ? 'lab' : 'study';

/**
 * Seconds the code step waits before offering "Resend code" again — matches
 * Supabase's per-address interval (Authentication → Rate Limits, default 60)
 * so a tap never runs into a refusal. "Change details" clears it: the next
 * send goes out immediately, and if the server still refuses the app shows
 * the exact wait it reports. Set VITE_OTP_RESEND_SECONDS when the dashboard
 * value changes; 0 disables the client-side countdown.
 */
const resendRaw = import.meta.env.VITE_OTP_RESEND_SECONDS;
export const OTP_RESEND_SECONDS =
  resendRaw !== undefined && resendRaw !== '' && Number.isFinite(Number(resendRaw))
    ? Math.max(0, Number(resendRaw))
    : 60;
