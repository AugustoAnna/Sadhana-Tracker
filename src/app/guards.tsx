import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';

export function LandingRedirect() {
  const profile = useAppStore((s) => s.profile);
  const instances = useAppStore((s) => s.instances);
  const authState = useAuthStore((s) => s.state);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready || !profile || authState === 'unknown') return null;

  // A device that has seen the app before (local name, or an anonymous session
  // from the pre-email build) goes straight to sign-in; a brand new one gets
  // the welcome screen first.
  if (authState === 'anonymous') {
    return <Navigate to="/sign-in" replace />;
  }
  if (authState === 'signed-out') {
    return <Navigate to={profile.name ? '/sign-in' : '/welcome'} replace />;
  }

  // Signed in but nameless can only happen if setName failed mid sign-in; the
  // sign-in screen finishes the job with a name-only step.
  if (!profile.name) {
    return <Navigate to="/sign-in" replace />;
  }

  if (!profile.onboardingComplete) {
    if (instances.length === 0) {
      return <Navigate to="/practices/edit" replace state={{ firstSetup: true }} />;
    }
    return <Navigate to="/reminders" replace state={{ firstSetup: true }} />;
  }

  return <Navigate to="/practice-home" replace />;
}

/** Everything behind this needs a signed-in account. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const authState = useAuthStore((s) => s.state);
  if (authState === 'unknown') return null;
  if (authState !== 'signed-in') {
    return <Navigate to="/sign-in" replace />;
  }
  return <>{children}</>;
}

/** The sign-in screen is for people who are not signed in — or signed in without a name yet. */
export function SignInGuard({ children }: { children: React.ReactNode }) {
  const authState = useAuthStore((s) => s.state);
  const profile = useAppStore((s) => s.profile);
  if (authState === 'unknown') return null;
  if (authState === 'signed-in' && profile?.name) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function WelcomeGuard({ children }: { children: React.ReactNode }) {
  const profile = useAppStore((s) => s.profile);
  const authState = useAuthStore((s) => s.state);
  if (authState === 'signed-in' && profile?.name) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function PostOnboardingGuard({ children }: { children: React.ReactNode }) {
  const profile = useAppStore((s) => s.profile);
  if (!profile?.onboardingComplete) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function SetupGuard({ children }: { children: React.ReactNode }) {
  const profile = useAppStore((s) => s.profile);
  if (profile?.onboardingComplete) {
    return <>{children}</>;
  }
  if (profile?.name) {
    return <>{children}</>;
  }
  return <Navigate to="/" replace />;
}
