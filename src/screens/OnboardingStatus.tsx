import { useNavigate } from 'react-router-dom';
import { Button } from '@/components';
import { useAppStore } from '@/stores/appStore';

export function OnboardingStatus() {
  const setMeditatorStatus = useAppStore((s) => s.setMeditatorStatus);
  const navigate = useNavigate();

  const handleAnswer = async (isMeditator: boolean) => {
    await setMeditatorStatus(isMeditator);
    navigate('/onboarding/reminder');
  };

  return (
    <div className="flex flex-col h-full px-4 bg-page">
      <div className="pt-14" />
      <div className="flex-1 flex flex-col justify-center -mt-10 px-2">
        <p className="eyebrow mb-3">A little about you</p>
        <h1 className="font-serif text-display mb-3">
          Have you completed Shambhavi Mahamudra Kriya?
        </h1>
        <p className="text-label text-secondary mb-8">
          This helps us tailor your experience.
        </p>
        <div className="flex flex-col gap-3">
          <Button fullWidth variant="secondary" onClick={() => handleAnswer(true)}>
            Yes
          </Button>
          <Button fullWidth variant="secondary" onClick={() => handleAnswer(false)}>
            No
          </Button>
        </div>
      </div>
    </div>
  );
}
