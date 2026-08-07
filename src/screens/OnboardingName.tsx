import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, TextInput } from '@/components';
import { useAppStore } from '@/stores/appStore';

export function OnboardingName() {
  const [name, setName] = useState('');
  const setNameStore = useAppStore((s) => s.setName);
  const navigate = useNavigate();

  const handleContinue = async () => {
    await setNameStore(name.trim());
    navigate('/onboarding/status');
  };

  return (
    <div className="flex flex-col h-full px-6">
      <div className="pt-12 px-2" />
      <div className="flex-1 flex flex-col justify-center -mt-16">
        <h1 className="font-serif text-[28px] font-semibold leading-tight mb-3">
          Let's put a name to your practice
        </h1>
        <p className="text-secondary mb-8">
          This helps us keep your progress connected to you.
        </p>
        <TextInput
          label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder=""
          autoFocus
        />
      </div>
      <div className="safe-bottom pb-4">
        <Button fullWidth disabled={name.trim().length === 0} onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
