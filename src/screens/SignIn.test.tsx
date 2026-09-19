import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SignIn } from '@/screens/SignIn';
import { EMAIL_TAKEN_MESSAGE } from '@/services/auth';

const requestCode = vi.fn<(email: string) => Promise<string | null>>();
const verifyCode = vi.fn<(email: string, code: string) => Promise<string | null>>();
const signOut = vi.fn(async (_opts?: { thenAnonymous?: boolean }) => { authState.state = 'signed-out'; });
const authState = { state: 'signed-out' as 'signed-out' | 'anonymous', requestCode, verifyCode, signOut };

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

let requireEmail = false;
vi.mock('@/config/environment', () => ({
  APP_ENV: 'study',
  get REQUIRE_EMAIL_SIGN_IN() { return requireEmail; },
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

beforeEach(() => {
  requestCode.mockReset().mockResolvedValue(null);
  verifyCode.mockReset().mockResolvedValue(null);
  signOut.mockClear();
  authState.state = 'signed-out';
  requireEmail = false;
});

describe('SignIn', () => {
  it('rejects a malformed email without calling the server', async () => {
    renderSignIn();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/valid email/);
    expect(requestCode).not.toHaveBeenCalled();
  });

  it('normalises the address, moves to the code step and verifies a 6-digit code', async () => {
    renderSignIn();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  Someone@Example.org ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await screen.findByText('Check your email');
    expect(requestCode).toHaveBeenCalledWith('someone@example.org');
    expect(screen.getByText('someone@example.org')).toBeTruthy();

    const codeInput = screen.getByLabelText('6-digit code');
    // Non-digits are stripped and the field is capped at six characters.
    fireEvent.change(codeInput, { target: { value: '12a34567' } });
    expect((codeInput as HTMLInputElement).value).toBe('123456');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(verifyCode).toHaveBeenCalledWith('someone@example.org', '123456'));
    await screen.findByText('landed home');
  });

  it('keeps the user on the code step with the error when the code is wrong', async () => {
    verifyCode.mockResolvedValueOnce('That code didn’t work.');
    renderSignIn();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByText('Check your email');

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/didn’t work/);
    expect((screen.getByLabelText('6-digit code') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText('landed home')).toBeNull();
  });

  it('holds the resend button for the cooldown window', async () => {
    renderSignIn();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByText('Check your email');
    const resend = screen.getByRole('button', { name: /Resend code in \d+s/ });
    expect((resend as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the linking copy for a pre-email anonymous session', () => {
    authState.state = 'anonymous';
    renderSignIn();
    expect(screen.getByText('Keep your progress')).toBeTruthy();
  });

  it('offers to switch to the existing account when the email is already taken while linking', async () => {
    authState.state = 'anonymous';
    requestCode.mockResolvedValueOnce(EMAIL_TAKEN_MESSAGE).mockResolvedValueOnce(null);
    renderSignIn();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    const switchButton = await screen.findByRole('button', { name: 'Use my existing account' });
    fireEvent.click(switchButton);

    await screen.findByText('Check your email');
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(requestCode).toHaveBeenCalledTimes(2);
    // The second request went out after the anonymous session was dropped.
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(requestCode.mock.invocationCallOrder[1]);
  });

  it('offers "Not now" only while email sign-in is optional', () => {
    const { unmount } = renderSignIn();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
    unmount();
    requireEmail = true;
    renderSignIn();
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
  });

  it('switches accounts without an anonymous session in between', async () => {
    authState.state = 'anonymous';
    requestCode.mockResolvedValueOnce(EMAIL_TAKEN_MESSAGE).mockResolvedValueOnce(null);
    renderSignIn();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use my existing account' }));
    await screen.findByText('Check your email');
    expect(signOut).toHaveBeenCalledWith({ thenAnonymous: false });
  });

  it('does not offer the switch for a plain sign-in error', async () => {
    requestCode.mockResolvedValueOnce(EMAIL_TAKEN_MESSAGE);
    renderSignIn();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Use my existing account' })).toBeNull();
  });
});
