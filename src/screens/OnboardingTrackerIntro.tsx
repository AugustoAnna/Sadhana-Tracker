import { useNavigate } from 'react-router-dom';
import { Button } from '@/components';
import { OnboardingLayout } from '@/components/OnboardingLayout';
import { useAppStore } from '@/stores/appStore';

export function OnboardingTrackerIntro() {
  const markTrackerIntroSeen = useAppStore((s) => s.markTrackerIntroSeen);
  const navigate = useNavigate();

  const handleContinue = async () => {
    await markTrackerIntroSeen();
    navigate('/practices/edit', { state: { firstSetup: true } });
  };

  return (
    <OnboardingLayout showBack backTo="/onboarding/status">
      <div className="flex flex-col justify-center min-h-[60vh] px-2">
        <h1 className="font-serif text-display mb-3">
          Track your sadhana
        </h1>
        <p className="text-label text-secondary mb-8">
          Add the practices you already do, and watch them accumulate day after day.
        </p>
        <Button fullWidth onClick={handleContinue}>
          Add practices
        </Button>
      </div>
    </OnboardingLayout>
  );
}
