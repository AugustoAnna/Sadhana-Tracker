import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, TextInput } from '@/components';
import { useKeyboardInset } from '@/hooks';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { EMAIL_TAKEN_MESSAGE, biometricLabel, isValidEmail } from '@/services/auth';
import { track } from '@/services/instrumentation';
import { reportAppOpen } from '@/services/appLifecycle';

/**
 * Supabase's "Email OTP Length" setting is 6–10 digits and lives in the
 * dashboard, so don't hard-wire one value: accept anything in that range and
 * let the server judge it.
 */
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;
const isCompleteCode = (value: string) => value.length >= MIN_CODE_LENGTH;

type Step = 'details' | 'code' | 'passkey-offer' | 'restoring';

/** Enter / the keyboard's Go key submits; the visible button lives in the footer. */
function submitOnEnter(action: () => Promise<void>) {
  return (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    void action();
  };
}

/**
 * The one entry point for everyone: name + email, then the emailed code.
 *
 * Three situations share the screen and differ only in copy and in what the
 * store does with the code:
 * - fresh device / new or returning participant → sign-in (`signInWithOtp`)
 * - pre-email anonymous session → link (`updateUser({ email })`, same user id)
 * - signed in but nameless (setName failed mid sign-in) → name-only, no code
 */
export function SignIn() {
  const navigate = useNavigate();
  const authState = useAuthStore((s) => s.state);
  const requestCode = useAuthStore((s) => s.requestCode);
  const verifyCode = useAuthStore((s) => s.verifyCode);
  const verifyCodeAndMerge = useAuthStore((s) => s.verifyCodeAndMerge);
  const signInWithPasskey = useAuthStore((s) => s.signInWithPasskey);
  const enablePasskey = useAuthStore((s) => s.enablePasskey);
  const passkeySupported = useAuthStore((s) => s.passkeySupported);
  const passkeyOnDevice = useAuthStore((s) => s.passkeyOnDevice);
  const profile = useAppStore((s) => s.profile);
  const setNameStore = useAppStore((s) => s.setName);
  const linking = authState === 'anonymous';
  const nameOnly = authState === 'signed-in';

  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState(profile?.name ?? '');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // There is no "resend" on the code step: a fresh code is requested by going
  // back through Change details → Send code, and the new code replaces the
  // old one. The only countdown that can appear is when Supabase's
  // per-address interval refuses a send — then exactly the wait it reports.
  const [cooldown, setCooldown] = useState<{ email: string; until: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Address a code went to in this session, so someone who went back to fix
  // their name can return to the code they already have.
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Set when the anonymous device's email already has an account: the code
  // is a sign-in to that account and the server merges this history into it.
  const [merging, setMerging] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useKeyboardInset();

  useEffect(() => {
    if (!cooldown || cooldown.until <= now) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooldown, now]);

  const secondsLeftFor = (address: string) =>
    cooldown && cooldown.email === address ? Math.max(0, Math.ceil((cooldown.until - now) / 1000)) : 0;
  const startCooldown = (address: string, seconds: number) => {
    setNow(Date.now());
    setCooldown({ email: address, until: Date.now() + seconds * 1000 });
  };

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const detailsComplete = trimmedName.length > 0 && (nameOnly || trimmedEmail.length > 0);
  const waitForDetails = nameOnly ? 0 : secondsLeftFor(trimmedEmail);
  const codeStillPending = !nameOnly && sentTo !== null && trimmedEmail === sentTo;

  const continueWithDetails = async () => {
    if (!trimmedName) {
      setError('Please enter your name.');
      return;
    }
    if (nameOnly) {
      setBusy(true);
      await setNameStore(trimmedName);
      navigate('/', { replace: true });
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err, retryAfter } = await requestCode(trimmedEmail);
    setBusy(false);
    if (err) {
      // The server knows the real interval; count down exactly what it says.
      if (retryAfter) startCooldown(trimmedEmail, retryAfter);
      setError(err);
      return;
    }
    setEmail(trimmedEmail);
    setSentTo(trimmedEmail);
    setCooldown(null);
    setCode('');
    setStep('code');
    void track('sign_in_code_sent', { linking });
    setTimeout(() => codeRef.current?.focus(), 0);
  };

  /**
   * The anonymous device's owner already has a permanent account (they signed
   * in with this email elsewhere first). Supabase can't attach the email to a
   * second user, so: keep everything as it is, send a sign-in code for the
   * existing account, and on verification the server moves this device's
   * history onto that account.
   */
  const continueWithExistingAccount = async () => {
    setBusy(true);
    setError(null);
    const { error: err, retryAfter } = await requestCode(trimmedEmail, { mode: 'sign-in' });
    setBusy(false);
    if (err) {
      if (retryAfter) startCooldown(trimmedEmail, retryAfter);
      setError(err);
      return;
    }
    setMerging(true);
    setEmail(trimmedEmail);
    setSentTo(trimmedEmail);
    setCooldown(null);
    setCode('');
    setStep('code');
    void track('sign_in_code_sent', { linking: false, merging: true });
    setTimeout(() => codeRef.current?.focus(), 0);
  };

  const finish = () => {
    setStep('restoring');
    // Boot skipped this while signed out; the participant row exists now.
    void reportAppOpen();
    navigate('/', { replace: true });
  };

  const submitCode = async () => {
    if (!isCompleteCode(code)) return;
    setBusy(true);
    setError(null);
    const err = merging
      ? await verifyCodeAndMerge(email, code, trimmedName)
      : await verifyCode(email, code, trimmedName);
    if (err) {
      setBusy(false);
      setError(err);
      setCode('');
      codeRef.current?.focus();
      return;
    }
    void track('sign_in_completed', { linking, merged: merging, method: 'code' });
    // Offer the faster door for next time — once per device, only where the
    // browser can actually do it. Anonymous users can't register one; they've
    // just been linked, so by now they can.
    if (passkeySupported && !useAuthStore.getState().passkeyOnDevice) {
      setBusy(false);
      setError(null);
      setStep('passkey-offer');
      return;
    }
    finish();
  };

  const usePasskey = async () => {
    setBusy(true);
    setError(null);
    const result = await signInWithPasskey();
    if (result === 'cancelled') {
      setBusy(false);
      return;
    }
    if (result) {
      setBusy(false);
      setError(result);
      return;
    }
    void track('sign_in_completed', { linking: false, method: 'passkey' });
    finish();
  };

  const acceptPasskeyOffer = async () => {
    setBusy(true);
    setError(null);
    const result = await enablePasskey();
    if (result === 'cancelled') {
      setBusy(false);
      return;
    }
    if (result) {
      // Don't hold the sign-in hostage to this; they can retry from Reminders.
      setBusy(false);
      setError(result);
      return;
    }
    void track('passkey_registered', { where: 'sign_in' });
    finish();
  };

  if (step === 'restoring') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-page">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-label text-secondary">Setting things up…</p>
      </div>
    );
  }

  const footerStyle = { paddingBottom: 'calc(1rem + var(--keyboard-inset, 0px))' };

  if (step === 'passkey-offer') {
    return (
      <div className="flex flex-col h-full bg-page">
        <div className="flex-1 overflow-y-auto px-4 pt-14">
          <h1 className="font-serif text-display mb-6">Sign in faster next time?</h1>
          <p className="text-label text-secondary mb-3">
            Use {biometricLabel()} instead of an emailed code whenever you need to sign in again on this device.
          </p>
          <p className="text-label text-secondary">
            Your fingerprint or face never leaves your device. You can turn this off any time under Reminders → Account.
          </p>
          {error && <p className="text-label text-error mt-4" role="alert">{error}</p>}
        </div>
        <div className="shrink-0 px-4 pb-4 safe-bottom border-t border-hairline pt-3" style={footerStyle}>
          <Button fullWidth disabled={busy} onClick={() => void acceptPasskeyOffer()}>
            {busy ? 'Setting up…' : `Use ${biometricLabel()}`}
          </Button>
          <Button variant="text" className="w-full mt-2" disabled={busy} onClick={finish}>
            Not now
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'details') {
    const heading = linking ? 'Keep your progress' : nameOnly ? 'What should we call you?' : 'Let’s get you set up';
    const intro = linking
      ? 'Add your email so your practice history stays with you if you change phones. We’ll email you a code to enter here.'
      : nameOnly
        ? 'Your name is shown on your practices.'
        : 'Your name is shown on your practices. We’ll email you a code to confirm your address — no password needed.';

    return (
      <div className="flex flex-col h-full bg-page">
        <div className="flex-1 overflow-y-auto px-4 pt-14">
          <h1 className="font-serif text-display mb-6">{heading}</h1>
          <p className="text-label text-secondary mb-6">{intro}</p>
          {/* noValidate: our own messages instead of the browser's tooltips. */}
          <form noValidate className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void continueWithDetails(); }}>
            <TextInput
              label="Your name"
              autoComplete="name"
              autoCapitalize="words"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              onKeyDown={submitOnEnter(continueWithDetails)}
              autoFocus={!name}
            />
            {!nameOnly && (
              <TextInput
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                onKeyDown={submitOnEnter(continueWithDetails)}
                autoFocus={!!name}
              />
            )}
            {error && <p className="text-label text-error" role="alert">{error}</p>}
          </form>
          {linking && error === EMAIL_TAKEN_MESSAGE && (
            <div className="bg-card rounded-[14px] p-4 mt-6">
              <p className="text-body mb-3">
                This email already has an account — you may have signed in with it on another device. Continue with that account and this phone’s history comes along with you.
              </p>
              <Button fullWidth variant="secondary" disabled={busy} onClick={() => void continueWithExistingAccount()}>
                Continue with that account
              </Button>
            </div>
          )}
        </div>
        <div className="shrink-0 px-4 pb-4 safe-bottom border-t border-hairline pt-3" style={footerStyle}>
          <Button fullWidth disabled={busy || !detailsComplete || waitForDetails > 0} onClick={() => void continueWithDetails()}>
            {busy
              ? (nameOnly ? 'Saving…' : 'Sending…')
              : nameOnly
                ? 'Continue'
                : waitForDetails > 0
                  ? `Send code (${waitForDetails}s)`
                  : 'Send code'}
          </Button>
          {codeStillPending && (
            // They came back to fix the name; the code already sent is still valid
            // (until they request another, which replaces it).
            <Button variant="text" className="w-full mt-2" disabled={busy} onClick={() => { setError(null); setStep('code'); }}>
              Enter the code I already received
            </Button>
          )}
          {passkeySupported && !linking && !nameOnly && (
            <Button variant="secondary" fullWidth className="mt-3" disabled={busy} onClick={() => void usePasskey()}>
              {passkeyOnDevice ? `Sign in with ${biometricLabel()}` : `Already set up ${biometricLabel()}? Use it`}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-page">
      <div className="flex-1 overflow-y-auto px-4 pt-14">
        <h1 className="font-serif text-display mb-6">Check your email</h1>
        <p className="text-label text-secondary mb-6">
          We sent a code to <span className="text-ink">{email}</span>. It may take a minute to arrive — check your spam folder too.
          Didn’t get it? Go back to <span className="text-ink">Change details</span> and send it again.
        </p>
        <form noValidate onSubmit={(e) => { e.preventDefault(); void submitCode(); }}>
          <TextInput
            ref={codeRef}
            label="Code from the email"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={MAX_CODE_LENGTH}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, MAX_CODE_LENGTH));
              setError(null);
            }}
            onKeyDown={submitOnEnter(submitCode)}
            className="tracking-[0.4em] text-center text-xl"
            autoFocus
          />
          {error && <p className="text-label text-error mt-3" role="alert">{error}</p>}
        </form>
        <div className="flex items-center justify-end mt-6">
          <Button
            variant="text"
            className="px-0"
            disabled={busy}
            onClick={() => { setStep('details'); setError(null); setCode(''); setMerging(false); setCooldown(null); }}
          >
            Change details
          </Button>
        </div>
      </div>
      <div className="shrink-0 px-4 pb-4 safe-bottom border-t border-hairline pt-3" style={footerStyle}>
        <Button fullWidth disabled={busy || !isCompleteCode(code)} onClick={() => void submitCode()}>
          {busy ? 'Checking…' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
