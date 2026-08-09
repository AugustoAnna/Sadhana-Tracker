import { useNavigate } from 'react-router-dom';
import { OnboardingLayout, OnboardingOption } from '@/components/OnboardingLayout';
import { useAppStore } from '@/stores/appStore';

export function OnboardingStatus() {
  const setMeditatorStatus = useAppStore((s) => s.setMeditatorStatus);
  const navigate = useNavigate();

  const handleAnswer = async (isMeditator: boolean) => {
    await setMeditatorStatus(isMeditator);
    if (isMeditator) {
      navigate('/onboarding/tracker-intro');
    } else {
      navigate('/onboarding/type');
    }
  };

  return (
    <OnboardingLayout showBack backTo="/onboarding/reminder">
      <div className="flex flex-col justify-center min-h-[60vh] px-2">
        <h1 className="font-serif text-display mb-8">
          Have you learnt any Isha practices?
        </h1>
        <div className="flex flex-col gap-3">
          <OnboardingOption label="Yes, I have a practice" onClick={() => handleAnswer(true)} />
          <OnboardingOption label="Not yet" onClick={() => handleAnswer(false)} />
        </div>
      </div>
    </OnboardingLayout>
  );
}
