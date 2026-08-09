import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import type { Profile } from '@/types';

function getOnboardingPath(profile: Profile, instanceCount: number): string {
  if (!profile.name) return '/onboarding/name';
  if (!profile.notificationPermissionAsked) return '/onboarding/reminder';
  if (profile.isMeditator === null) return '/onboarding/status';

  if (profile.isMeditator) {
    if (!profile.trackerIntroSeen) return '/onboarding/tracker-intro';
    if (!profile.onboardingComplete) {
      return instanceCount > 0 ? '/reminders' : '/practices/edit';
    }
  } else {
    if (!profile.drawnToType) return '/onboarding/type';
    if (!profile.durationPreference) return '/onboarding/duration';
  }

  if (!profile.onboardingComplete) return '/onboarding/status';
  return '/practice-home';
}

export function LandingRedirect() {
  const profile = useAppStore((s) => s.profile);
  const instances = useAppStore((s) => s.instances);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready || !profile) return null;

  if (!profile.onboardingComplete) {
    const path = getOnboardingPath(profile, instances.length);
    return <Navigate to={path} replace state={path.includes('edit') ? { firstSetup: true } : path.includes('reminders') ? { firstSetup: true } : undefined} />;
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

/** Allows practice edit and reminders during meditator onboarding. */
export function MeditatorSetupGuard({ children }: { children: React.ReactNode }) {
  const profile = useAppStore((s) => s.profile);
  if (profile?.onboardingComplete) {
    return <>{children}</>;
  }
  if (profile?.isMeditator && profile.trackerIntroSeen) {
    return <>{children}</>;
  }
  return <Navigate to="/" replace />;
}
