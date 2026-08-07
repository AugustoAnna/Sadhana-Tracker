import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';

export function LandingRedirect() {
  const profile = useAppStore((s) => s.profile);
  const instances = useAppStore((s) => s.instances);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready || !profile) return null;

  if (!profile.name) {
    return <Navigate to="/onboarding/name" replace />;
  }

  if (!profile.onboardingComplete) {
    if (profile.isMeditator === null) {
      return <Navigate to="/onboarding/status" replace />;
    }
    return <Navigate to="/onboarding/reminder" replace />;
  }

  if (instances.length > 0) {
    return <Navigate to="/app-home" replace />;
  }

  return <Navigate to="/practice-home" replace />;
}

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const profile = useAppStore((s) => s.profile);
  if (profile?.onboardingComplete) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function NameGuard({ children }: { children: React.ReactNode }) {
  const profile = useAppStore((s) => s.profile);
  if (profile?.name) {
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
