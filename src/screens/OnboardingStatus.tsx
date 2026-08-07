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
    <div className="flex flex-col h-full px-6">
      <div className="pt-12 px-2" />
      <div className="flex-1 flex flex-col justify-center -mt-16">
        <h1 className="font-serif text-[28px] font-semibold leading-tight mb-3">
          Have you completed Shambhavi Mahamudra Kriya?
        </h1>
        <p className="text-secondary mb-8">
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
