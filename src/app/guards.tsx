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
    return <Navigate to="/welcome" replace />;
  }

  if (!profile.onboardingComplete) {
    if (instances.length === 0) {
      return <Navigate to="/practices/edit" replace state={{ firstSetup: true }} />;
    }
    return <Navigate to="/reminders" replace state={{ firstSetup: true }} />;
  }

  return <Navigate to="/practice-home" replace />;
}

export function WelcomeGuard({ children }: { children: React.ReactNode }) {
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
