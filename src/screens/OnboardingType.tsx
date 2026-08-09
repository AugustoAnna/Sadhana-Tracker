import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components';
import { OnboardingLayout, OnboardingOption } from '@/components/OnboardingLayout';
import { useAppStore } from '@/stores/appStore';
import type { DrawnToType } from '@/types';

const OPTIONS: { value: DrawnToType; label: string }[] = [
  { value: 'physical-yoga', label: 'Physical yoga' },
  { value: 'pranayama', label: 'Pranayama' },
  { value: 'meditation', label: 'Meditation' },
  { value: 'chants', label: 'Chants and mantras' },
];

export function OnboardingType() {
  const [selected, setSelected] = useState<DrawnToType | null>(null);
  const setDrawnToType = useAppStore((s) => s.setDrawnToType);
  const navigate = useNavigate();

  const handleContinue = async () => {
    if (!selected) return;
    await setDrawnToType(selected);
    navigate('/onboarding/duration');
  };

  return (
    <OnboardingLayout
      showBack
      backTo="/onboarding/status"
      footer={
        <Button fullWidth disabled={!selected} onClick={handleContinue}>
          Continue
        </Button>
      }
    >
      <div className="px-2 pt-4">
        <h1 className="font-serif text-display mb-8">
          What are you drawn to?
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
