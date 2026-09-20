import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SignIn } from '@/screens/SignIn';
import { EMAIL_TAKEN_MESSAGE } from '@/services/auth';

const requestCode = vi.fn<(email: string, opts?: { mode?: string }) => Promise<string | null>>();
const verifyCode = vi.fn<(email: string, code: string, name: string) => Promise<string | null>>();
const verifyCodeAndMerge = vi.fn<(email: string, code: string, name: string) => Promise<string | null>>();
const signOut = vi.fn(async () => { authState.state = 'signed-out'; });
const signInWithPasskey = vi.fn<() => Promise<string | null>>();
const enablePasskey = vi.fn<() => Promise<string | null>>();
const authState = {
  state: 'signed-out' as string,
  passkeySupported: false,
  passkeyOnDevice: false,
  requestCode, verifyCode, verifyCodeAndMerge, signOut, signInWithPasskey, enablePasskey,
};
const setName = vi.fn(async (_name: string) => undefined);
const appState = { profile: { name: '' } as { name: string } | null, setName };

vi.mock('@/stores/authStore', () => {
  const useAuthStore = (selector: (s: typeof authState) => unknown) => selector(authState);
  useAuthStore.getState = () => authState;
  return { useAuthStore };
});
vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector: (s: typeof appState) => unknown) => selector(appState),
}));
vi.mock('@/services/instrumentation', () => ({ track: vi.fn(async () => undefined) }));
vi.mock('@/services/appLifecycle', () => ({ reportAppOpen: vi.fn(async () => undefined) }));
vi.mock('@/hooks', () => ({ useKeyboardInset: () => undefined }));

function renderSignIn() {
  return render(
    <MemoryRouter initialEntries={['/sign-in']}>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/" element={<p>landed home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillDetails(name = 'Priya', email = 'a@b.co') {
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
}

beforeEach(() => {
  requestCode.mockReset().mockResolvedValue(null);
  verifyCode.mockReset().mockResolvedValue(null);
  verifyCodeAndMerge.mockReset().mockResolvedValue(null);
  signOut.mockClear();
  setName.mockClear();
  signInWithPasskey.mockReset().mockResolvedValue(null);
  enablePasskey.mockReset().mockResolvedValue(null);
  authState.state = 'signed-out';
  authState.passkeySupported = false;
  authState.passkeyOnDevice = false;
  appState.profile = { name: '' };
});

describe('SignIn', () => {
  it('asks for name and email together and blocks until both are filled', () => {
    renderSignIn();
    const send = () => screen.getByRole('button', { name: 'Send code' }) as HTMLButtonElement;
    expect(send().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Priya' } });
    expect(send().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    expect(send().disabled).toBe(false);
  });

  it('rejects a malformed email without calling the server', async () => {
    renderSignIn();
    fillDetails('Priya', 'nope');
    expect((await screen.findByRole('alert')).textContent).toMatch(/valid email/);
    expect(requestCode).not.toHaveBeenCalled();
  });

  it('normalises the address, moves to the code step and verifies with the typed name', async () => {
    renderSignIn();
    fillDetails('  Priya ', '  Someone@Example.org ');

    await screen.findByText('Check your email');
    expect(requestCode).toHaveBeenCalledWith('someone@example.org');
    expect(screen.getByText('someone@example.org')).toBeTruthy();

    const codeInput = screen.getByLabelText('Code from the email');
    // Non-digits are stripped; length follows the project's OTP setting (6–10),
    // so an 8-digit code must survive intact.
    fireEvent.change(codeInput, { target: { value: '12a345678' } });
    expect((codeInput as HTMLInputElement).value).toBe('12345678');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(verifyCode).toHaveBeenCalledWith('someone@example.org', '12345678', 'Priya'));
    await screen.findByText('landed home');
  });

  it('keeps the user on the code step with the error when the code is wrong', async () => {
    verifyCode.mockResolvedValueOnce('That code didn’t work.');
    renderSignIn();
    fillDetails();
    await screen.findByText('Check your email');

    fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/didn’t work/);
    expect((screen.getByLabelText('Code from the email') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText('landed home')).toBeNull();
  });

  it('keeps Continue disabled until at least six digits are entered', async () => {
    renderSignIn();
    fillDetails();
    await screen.findByText('Check your email');
    const cont = () => screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '12345' } });
    expect(cont().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '123456' } });
    expect(cont().disabled).toBe(false);
  });

  it('holds the resend button for the cooldown window', async () => {
    renderSignIn();
    fillDetails();
    await screen.findByText('Check your email');
    const resend = screen.getByRole('button', { name: /Resend code in \d+s/ });
    expect((resend as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the linking copy with the existing name prefilled for a pre-email anonymous session', () => {
    authState.state = 'anonymous';
    appState.profile = { name: 'Neha' };
    renderSignIn();
    expect(screen.getByText('Keep your progress')).toBeTruthy();
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Neha');
  });

  it('merges into the existing account when the email is already taken while linking — no sign-out, no wipe', async () => {
    authState.state = 'anonymous';
    requestCode.mockResolvedValueOnce(EMAIL_TAKEN_MESSAGE).mockResolvedValueOnce(null);
    renderSignIn();
    fillDetails();

    fireEvent.click(await screen.findByRole('button', { name: 'Continue with that account' }));
    await screen.findByText('Check your email');
    expect(signOut).not.toHaveBeenCalled();
    // second request is a sign-in code for the existing account, not a link attempt
    expect(requestCode).toHaveBeenLastCalledWith('a@b.co', { mode: 'sign-in' });

    fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(verifyCodeAndMerge).toHaveBeenCalledWith('a@b.co', '123456', 'Priya'));
    expect(verifyCode).not.toHaveBeenCalled();
    await screen.findByText('landed home');
  });

  it('shows the merge error and stays on the code step when the merge fails', async () => {
    authState.state = 'anonymous';
    requestCode.mockResolvedValueOnce(EMAIL_TAKEN_MESSAGE).mockResolvedValueOnce(null);
    verifyCodeAndMerge.mockResolvedValueOnce('We couldn’t bring this phone’s history over.');
    renderSignIn();
    fillDetails();
    fireEvent.click(await screen.findByRole('button', { name: 'Continue with that account' }));
    await screen.findByText('Check your email');
    fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/history over/);
    expect(screen.queryByText('landed home')).toBeNull();
  });

  it('does not offer the merge for a plain sign-in error', async () => {
    requestCode.mockResolvedValueOnce(EMAIL_TAKEN_MESSAGE);
    renderSignIn();
    fillDetails();
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Continue with that account' })).toBeNull();
  });

  it('only asks for a name when already signed in without one', async () => {
    authState.state = 'signed-in';
    renderSignIn();
    expect(screen.queryByLabelText('Email')).toBeNull();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Priya' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('landed home');
    expect(setName).toHaveBeenCalledWith('Priya');
    expect(requestCode).not.toHaveBeenCalled();
  });

  describe('passkeys', () => {
    it('shows no passkey button when the browser cannot do one', () => {
      renderSignIn();
      expect(screen.queryByRole('button', { name: /Face ID|fingerprint/ })).toBeNull();
    });

    it('offers passkey sign-in on the details step and lands home on success', async () => {
      authState.passkeySupported = true;
      authState.passkeyOnDevice = true;
      renderSignIn();
      fireEvent.click(screen.getByRole('button', { name: /Sign in with/ }));
      await screen.findByText('landed home');
      expect(signInWithPasskey).toHaveBeenCalledTimes(1);
      expect(requestCode).not.toHaveBeenCalled();
    });

    it('stays put quietly when the system prompt is dismissed', async () => {
      authState.passkeySupported = true;
      signInWithPasskey.mockResolvedValueOnce('cancelled');
      renderSignIn();
      fireEvent.click(screen.getByRole('button', { name: /Use it/ }));
      await waitFor(() => expect(signInWithPasskey).toHaveBeenCalled());
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByLabelText('Email')).toBeTruthy();
    });

    it('does not offer a passkey while linking an anonymous session', () => {
      authState.passkeySupported = true;
      authState.state = 'anonymous';
      renderSignIn();
      expect(screen.queryByRole('button', { name: /Face ID|fingerprint/ })).toBeNull();
    });

    it('offers to set up a passkey after a code sign-in, once per device', async () => {
      authState.passkeySupported = true;
      renderSignIn();
      fillDetails();
      await screen.findByText('Check your email');
      fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

      await screen.findByText('Sign in faster next time?');
      fireEvent.click(screen.getByRole('button', { name: /^Use / }));
      await screen.findByText('landed home');
      expect(enablePasskey).toHaveBeenCalledTimes(1);
    });

    it('lets the offer be skipped', async () => {
      authState.passkeySupported = true;
      renderSignIn();
      fillDetails();
      await screen.findByText('Check your email');
      fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await screen.findByText('Sign in faster next time?');
      fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
      await screen.findByText('landed home');
      expect(enablePasskey).not.toHaveBeenCalled();
    });

    it('skips the offer when this device already has a passkey', async () => {
      authState.passkeySupported = true;
      authState.passkeyOnDevice = true;
      renderSignIn();
      fillDetails();
      await screen.findByText('Check your email');
      fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await screen.findByText('landed home');
      expect(screen.queryByText('Sign in faster next time?')).toBeNull();
    });
  });
});
