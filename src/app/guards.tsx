import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { REQUIRE_EMAIL_SIGN_IN } from '@/config/environment';

export function LandingRedirect() {
  const profile = useAppStore((s) => s.profile);
  const instances = useAppStore((s) => s.instances);
  const authState = useAuthStore((s) => s.state);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready || !profile) return null;

  if (REQUIRE_EMAIL_SIGN_IN) {
    if (authState === 'unknown') return null;
    // A device that has seen the app before (local name, or an anonymous
    // session from the pre-email build) goes straight to sign-in; a brand new
    // one gets the welcome screen first.
    if (authState === 'anonymous') {
      return <Navigate to="/sign-in" replace />;
    }
    if (authState === 'signed-out') {
      return <Navigate to={profile.name ? '/sign-in' : '/welcome'} replace />;
    }
  }

  if (!profile.name) {
    // Required mode reaches here only once signed in, so the welcome screen's
    // "Get started" (which leads to sign-in) has already been passed.
    return <Navigate to={REQUIRE_EMAIL_SIGN_IN ? '/welcome/name' : '/welcome'} replace />;
  }

  if (!profile.onboardingComplete) {
    if (instances.length === 0) {
      return <Navigate to="/practices/edit" replace state={{ firstSetup: true }} />;
    }
    return <Navigate to="/reminders" replace state={{ firstSetup: true }} />;
  }

  return <Navigate to="/practice-home" replace />;
}

/** Everything behind this needs a signed-in account — once email sign-in is required. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const authState = useAuthStore((s) => s.state);
  if (!REQUIRE_EMAIL_SIGN_IN) return <>{children}</>;
  if (authState === 'unknown') return null;
  if (authState !== 'signed-in') {
    return <Navigate to="/sign-in" replace />;
  }
  return <>{children}</>;
}

/** The sign-in screen is for people who are not signed in. */
export function SignInGuard({ children }: { children: React.ReactNode }) {
  const authState = useAuthStore((s) => s.state);
  if (authState === 'unknown') return null;
  if (authState === 'signed-in') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function WelcomeGuard({ children }: { children: React.ReactNode }) {
  const profile = useAppStore((s) => s.profile);
  const authState = useAuthStore((s) => s.state);
  const pastSignIn = !REQUIRE_EMAIL_SIGN_IN || authState === 'signed-in';
  if (pastSignIn && profile?.name) {
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
