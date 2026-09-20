import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Welcome } from '@/screens/Welcome';

let requireEmail = false;
vi.mock('@/config/environment', () => ({
  APP_ENV: 'study',
  get REQUIRE_EMAIL_SIGN_IN() { return requireEmail; },
}));

const signOut = vi.fn(async (_opts?: { thenAnonymous?: boolean }) => undefined);
const ensureSession = vi.fn(async () => undefined);
const authState = { state: 'anonymous' as string, signOut, ensureSession };
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

vi.mock('@/components', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  PracticeIllustration: () => null,
}));

function renderWelcome() {
  return render(
    <MemoryRouter initialEntries={['/welcome']}>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/welcome/name" element={<p>name step</p>} />
        <Route path="/sign-in" element={<p>sign-in screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  signOut.mockClear();
  ensureSession.mockClear();
  requireEmail = false;
  authState.state = 'anonymous';
});

describe('Welcome', () => {
  it('goes straight to the name step in the anonymous build', async () => {
    renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    await screen.findByText('name step');
  });

  it('lets a returning participant sign in without linking the fresh anonymous user', async () => {
    renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: /Sign in/ }));
    await screen.findByText('sign-in screen');
    expect(signOut).toHaveBeenCalledWith({ thenAnonymous: false });
  });

  it('routes Get started to sign-in when email is required and nobody is signed in', async () => {
    requireEmail = true;
    authState.state = 'signed-out';
    renderWelcome();
    expect(screen.queryByRole('button', { name: /Already added/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    await screen.findByText('sign-in screen');
  });

  it('re-creates a session on Get started after a sign-in tap was abandoned', async () => {
    authState.state = 'signed-out';
    renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    await waitFor(() => expect(ensureSession).toHaveBeenCalled());
  });
});
