import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, TextInput } from '@/components';
import { useKeyboardInset } from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import { EMAIL_TAKEN_MESSAGE, isValidEmail } from '@/services/auth';
import { track } from '@/services/instrumentation';
import { reportAppOpen } from '@/services/appLifecycle';
import { REQUIRE_EMAIL_SIGN_IN } from '@/config/environment';

/** Supabase refuses a second code to the same address inside this window. */
const RESEND_COOLDOWN_S = 60;
const CODE_LENGTH = 6;

type Step = 'email' | 'code' | 'restoring';

/** Enter / the keyboard's Go key submits; the visible button lives in the footer. */
function submitOnEnter(action: () => Promise<void>) {
  return (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    void action();
  };
}

export function SignIn() {
  const navigate = useNavigate();
  const authState = useAuthStore((s) => s.state);
  const requestCode = useAuthStore((s) => s.requestCode);
  const verifyCode = useAuthStore((s) => s.verifyCode);
  const signOut = useAuthStore((s) => s.signOut);
  const linking = authState === 'anonymous';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useKeyboardInset();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    const err = await requestCode(trimmed);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setEmail(trimmed);
    setCode('');
    setCooldown(RESEND_COOLDOWN_S);
    setStep('code');
    setError(null);
    void track('sign_in_code_sent', { linking });
    // autoFocus only fires on mount; the input is already mounted on resend.
    setTimeout(() => codeRef.current?.focus(), 0);
  };

  /**
   * The anonymous device's owner already has a permanent account (they signed
   * in with this email elsewhere first). Linking can't merge two auth users, so
   * switch this device to the existing account: signOut() flushes whatever is
   * still queued under the anonymous session, wipes the local copy, and the
   * next verify restores the account's history from the server.
   */
  const switchToExistingAccount = async () => {
    setBusy(true);
    setError(null);
    // No fresh anonymous session in between — the next request must be a real sign-in.
    await signOut({ thenAnonymous: false });
    setBusy(false);
    await sendCode();
  };

  const submitCode = async () => {
    if (code.length !== CODE_LENGTH) return;
    setBusy(true);
    setError(null);
    const err = await verifyCode(email, code);
    if (err) {
      setBusy(false);
      setError(err);
      setCode('');
      codeRef.current?.focus();
      return;
    }
    setStep('restoring');
    void track('sign_in_completed', { linking });
    // Boot skipped this while signed out; the participant row exists now.
    void reportAppOpen();
    navigate('/', { replace: true });
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
  // Optional in the anonymous build: the screen is reached from inside the app
  // and must offer a way back. Required mode has nowhere else to go.
  const dismiss = REQUIRE_EMAIL_SIGN_IN ? null : (
    <Button variant="text" className="w-full mt-2" disabled={busy} onClick={() => navigate(-1)}>
      Not now
    </Button>
  );

  if (step === 'email') {
    return (
      <div className="flex flex-col h-full bg-page">
        <div className="flex-1 overflow-y-auto px-4 pt-14">
          <h1 className="font-serif text-display mb-6">
            {linking ? 'Keep your progress' : 'Sign in'}
          </h1>
          <p className="text-label text-secondary mb-6">
            {linking
              ? 'Add your email so your practice history stays with you if you change phones. We’ll send you a 6‑digit code.'
              : 'Enter your email and we’ll send you a 6‑digit code. No password needed.'}
          </p>
          {/* noValidate: our own message instead of the browser's tooltip for a bad address. */}
          <form noValidate onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
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
              onKeyDown={submitOnEnter(sendCode)}
              autoFocus
            />
            {error && <p className="text-label text-error mt-3" role="alert">{error}</p>}
          </form>
          {linking && error === EMAIL_TAKEN_MESSAGE && (
            <div className="bg-card rounded-[14px] p-4 mt-6">
              <p className="text-body mb-3">
                Looks like you already signed in with this email on another device. You can continue with that account here instead.
              </p>
              <Button fullWidth variant="secondary" disabled={busy} onClick={() => void switchToExistingAccount()}>
                Use my existing account
              </Button>
            </div>
          )}
        </div>
        <div className="shrink-0 px-4 pb-4 safe-bottom border-t border-hairline pt-3" style={footerStyle}>
          <Button fullWidth disabled={busy || email.trim().length === 0} onClick={() => void sendCode()}>
            {busy ? 'Sending…' : 'Send code'}
          </Button>
          {dismiss}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-page">
      <div className="flex-1 overflow-y-auto px-4 pt-14">
        <h1 className="font-serif text-display mb-6">Check your email</h1>
        <p className="text-label text-secondary mb-6">
          We sent a code to <span className="text-ink">{email}</span>. It may take a minute to arrive.
        </p>
        <form noValidate onSubmit={(e) => { e.preventDefault(); void submitCode(); }}>
          <TextInput
            ref={codeRef}
            label="6-digit code"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH));
              setError(null);
            }}
            onKeyDown={submitOnEnter(submitCode)}
            className="tracking-[0.4em] text-center text-xl"
            autoFocus
          />
          {error && <p className="text-label text-error mt-3" role="alert">{error}</p>}
        </form>
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="text"
            className="px-0"
            disabled={busy || cooldown > 0}
            onClick={() => void sendCode()}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </Button>
          <Button
            variant="text"
            className="px-0"
            disabled={busy}
            onClick={() => { setStep('email'); setError(null); setCode(''); }}
          >
            Change email
          </Button>
        </div>
      </div>
      <div className="shrink-0 px-4 pb-4 safe-bottom border-t border-hairline pt-3" style={footerStyle}>
        <Button fullWidth disabled={busy || code.length !== CODE_LENGTH} onClick={() => void submitCode()}>
          {busy ? 'Checking…' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
