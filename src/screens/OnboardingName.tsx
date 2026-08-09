import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, TextInput } from '@/components';
import { OnboardingLayout } from '@/components/OnboardingLayout';
import { useAppStore } from '@/stores/appStore';

export function OnboardingName() {
  const [name, setName] = useState('');
  const setNameStore = useAppStore((s) => s.setName);
  const navigate = useNavigate();

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--keyboard-inset', `${inset}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);

  const handleContinue = async () => {
    await setNameStore(name.trim());
    navigate('/onboarding/reminder');
  };

  return (
    <OnboardingLayout
      footer={
        <div style={{ paddingBottom: 'var(--keyboard-inset, 0px)' }}>
          <Button fullWidth disabled={name.trim().length === 0} onClick={handleContinue}>
            Continue
          </Button>
        </div>
      }
    >
      <div className="flex flex-col justify-center min-h-[50vh] px-2">
        <h1 className="font-serif text-display mb-3">
          What should we call you?
        </h1>
        <div className="bg-card rounded-[14px] p-4 mt-6">
          <TextInput
            label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder=""
            autoFocus
          />
        </div>
      </div>
    </OnboardingLayout>
  );
}
