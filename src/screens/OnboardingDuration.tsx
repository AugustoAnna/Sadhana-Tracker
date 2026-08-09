import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components';
import { OnboardingLayout, OnboardingOption } from '@/components/OnboardingLayout';
import { useAppStore } from '@/stores/appStore';
import { precacheInvocation } from '@/services/audio';
import type { DurationPreference } from '@/types';

const OPTIONS: { value: DurationPreference; label: string }[] = [
  { value: 'under-5', label: 'Under 5 minutes' },
  { value: '5-10', label: '5 to 10 minutes' },
  { value: '10-20', label: '10 to 20 minutes' },
  { value: 'over-20', label: 'More than 20 minutes' },
];

export function OnboardingDuration() {
  const [selected, setSelected] = useState<DurationPreference | null>(null);
  const setDurationPreference = useAppStore((s) => s.setDurationPreference);
  const completePotentialOnboarding = useAppStore((s) => s.completePotentialOnboarding);
  const navigate = useNavigate();

  const handleContinue = async () => {
    if (!selected) return;
    await setDurationPreference(selected);
    await completePotentialOnboarding();
    await precacheInvocation();
    navigate('/practice-home', { replace: true });
  };

  return (
    <OnboardingLayout
      showBack
      backTo="/onboarding/type"
      footer={
        <Button fullWidth disabled={!selected} onClick={handleContinue}>
          Continue
        </Button>
      }
    >
      <div className="px-2 pt-4">
        <h1 className="font-serif text-display mb-8">
          How much time can you give?
        </h1>
        <div className="flex flex-col gap-3">
          {OPTIONS.map((opt) => (
            <OnboardingOption
              key={opt.value}
              label={opt.label}
              selected={selected === opt.value}
              onClick={() => setSelected(opt.value)}
            />
          ))}
        </div>
      </div>
    </OnboardingLayout>
  );
}
