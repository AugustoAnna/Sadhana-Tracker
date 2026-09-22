import { useRef, useState } from 'react';
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

type Step = 'details' | 'code' | 'restoring';
type EntryMode = 'sign-in' | 'sign-up';

interface SignInProps {
  mode?: EntryMode;
}

/** Enter / the keyboard's Go key submits; the visible button lives in the footer. */
function submitOnEnter(action: () => Promise<void>) {
  return (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    void action();
  };
}

/**
 * Shared auth screen used as either sign-up or sign-in entry.
 */
export function SignIn({ mode = 'sign-in' }: SignInProps) {
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
  const explicitSignIn = mode === 'sign-in' && !linking && !nameOnly;
  const explicitSignUp = mode === 'sign-up' && !linking && !nameOnly;
  const canGoBackToWelcome = explicitSignUp || explicitSignIn;

  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState(profile?.name ?? '');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the anonymous device's email already has an account: the code
  // is a sign-in to that account and the server merges this history into it.
  const [merging, setMerging] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useKeyboardInset();

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const detailsComplete = nameOnly
    ? trimmedName.length > 0
    : explicitSignIn
      ? trimmedEmail.length > 0
      : trimmedName.length > 0 && trimmedEmail.length > 0;

  const continueWithDetails = async () => {
    if (!explicitSignIn && !trimmedName) {
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

    if (explicitSignIn && passkeySupported && passkeyOnDevice) {
      setBusy(true);
      setError(null);
      const result = await signInWithPasskey();
      if (!result) {
        void track('sign_in_completed', { linking: false, method: 'passkey' });
        finish();
        return;
      }
    }

    setBusy(true);
    setError(null);
    const { error: err } = await requestCode(trimmedEmail, explicitSignIn ? { mode: 'sign-in' } : undefined);
    setBusy(false);
    if (err) {
      // The server knows the real interval and includes that wait in its message.
      setError(err);
      return;
    }
    setEmail(trimmedEmail);
    setCode('');
    setStep('code');
    void track('sign_in_code_sent', { linking });
    // autoFocus only fires on mount; the input is already mounted on resend.
    setTimeout(() => codeRef.current?.focus(), 0);
  };

  const resendCode = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await requestCode(email, merging ? { mode: 'sign-in' } : undefined);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setCode('');
    codeRef.current?.focus();
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
    const { error: err } = await requestCode(trimmedEmail, { mode: 'sign-in' });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setMerging(true);
    setEmail(trimmedEmail);
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
      : await verifyCode(email, code, explicitSignIn ? '' : trimmedName);
    if (err) {
      setBusy(false);
      setError(err);
      setCode('');
      codeRef.current?.focus();
      return;
    }
    void track('sign_in_completed', { linking, merged: merging, method: 'code' });
    // Best effort: register this device's passkey right after a successful code
    // sign-in so future logins can use biometrics.
    if (passkeySupported && !useAuthStore.getState().passkeyOnDevice) {
      const setupResult = await enablePasskey();
      if (!setupResult) void track('passkey_registered', { where: 'sign_in' });
    }
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

  if (step === 'details') {
    const heading = linking
      ? 'Keep your progress'
      : nameOnly
        ? 'What should we call you?'
        : explicitSignIn
          ? 'Welcome back'
          : 'Let’s get you set up';
    const intro = linking
      ? 'Add your email so your practice history stays with you if you change phones. We’ll email you a code to enter here.'
      : nameOnly
        ? 'Your name is shown on your practices.'
        : explicitSignIn
          ? `Enter your email to sign in. If ${biometricLabel()} is available on this device, we’ll use it first; otherwise we’ll send a fresh code.`
          : 'We’ll email you a code.';

    return (
      <div className={`flex flex-col h-full bg-page ${explicitSignUp ? 'sign-up-font-boost' : ''}`}>
        <div className="flex-1 overflow-y-auto px-4 pt-14">
          {canGoBackToWelcome && (
            <button
              onClick={() => navigate('/welcome')}
              aria-label="Go back"
              className="w-11 h-11 flex items-center justify-center -ml-2 mb-3 rounded-full"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <h1 className="font-serif text-display mb-6">{heading}</h1>
          <p className="text-label text-secondary mb-6">{intro}</p>
          {/* noValidate: our own messages instead of the browser's tooltips. */}
          <form noValidate className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void continueWithDetails(); }}>
            {!explicitSignIn && (
              <TextInput
                label="Your name"
                autoComplete="name"
                autoCapitalize="words"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                onKeyDown={submitOnEnter(continueWithDetails)}
                autoFocus={!name}
              />
            )}
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
                autoFocus={explicitSignIn || !!name}
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
          <Button fullWidth disabled={busy || !detailsComplete} onClick={() => void continueWithDetails()}>
            {busy
              ? (nameOnly ? 'Saving…' : 'Sending…')
              : nameOnly
                ? 'Continue'
                : explicitSignIn
                  ? 'Continue'
                  : 'Send code'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-page">
      <div className="flex-1 overflow-y-auto px-4 pt-14">
        <button
          onClick={() => { setStep('details'); setError(null); setCode(''); setMerging(false); }}
          aria-label="Go back"
          className="w-11 h-11 flex items-center justify-center -ml-2 mb-3 rounded-full"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="font-serif text-display mb-6">Check your email</h1>
        <p className="text-label text-secondary mb-6">
          We sent a code to <span className="text-ink font-semibold">{email}</span>. It may take a minute to arrive.
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
        <p className="text-label text-secondary mt-3">
          <span className="block">Didn&apos;t receive a code?</span>
          Please check your spam folder as well as whether the email above is correct. You can edit it by going back and getting a new code.
        </p>
        <div className="mt-6">
          <Button
            variant="text"
            className="px-0"
            disabled={busy}
            onClick={() => void resendCode()}
          >
            Resend code
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
