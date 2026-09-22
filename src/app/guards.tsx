import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';

function GuardLoading() {
  return (
    <div className="h-full flex items-center justify-center bg-page">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function LandingRedirect() {
  const profile = useAppStore((s) => s.profile);
  const instances = useAppStore((s) => s.instances);
  const authState = useAuthStore((s) => s.state);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready || !profile || authState === 'unknown') return <GuardLoading />;

  if (authState === 'anonymous') {
    return <Navigate to="/sign-in" replace />;
  }
  if (authState === 'signed-out') {
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
  if (authState === 'unknown') return <GuardLoading />;
  if (authState !== 'signed-in') {
    return <Navigate to="/sign-in" replace />;
  }
  return <>{children}</>;
}

/** The sign-in screen is for people who are not signed in. */
export function SignInGuard({ children }: { children: React.ReactNode }) {
  const authState = useAuthStore((s) => s.state);
  if (authState === 'unknown') return <GuardLoading />;
  if (authState === 'signed-in') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function WelcomeGuard({ children }: { children: React.ReactNode }) {
  const authState = useAuthStore((s) => s.state);
  if (authState === 'signed-in') {
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
  return <>{children}</>;
}
