import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components';
import { useAppStore } from '@/stores/appStore';
import { POST_PRACTICE_MIN_DURATION_MS } from '@/data/constants';

export function PostPractice() {
  const navigate = useNavigate();
  const levelCrossed = useAppStore((s) => s.levelCrossed);
  const [canContinue, setCanContinue] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setCanContinue(true), POST_PRACTICE_MIN_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => {
    if (levelCrossed) {
      navigate('/level-up', { replace: true });
    } else {
      navigate('/practice-home', { replace: true });
    }
  };

  return (
    <div
      className="h-full bg-player flex flex-col items-center justify-center relative"
      onClick={() => canContinue && handleContinue()}
    >
      <button
        onClick={handleContinue}
        className="absolute top-12 right-4 text-white/50 text-sm"
      >
        Skip
      </button>

      <div className="w-64 h-64 bg-amber-900/20 rounded-lg flex items-center justify-center">
        <p className="text-white/30 text-sm text-center">Stillness<br/>(placeholder image)</p>
      </div>

      {canContinue && (
        <div className="absolute bottom-8 left-4 right-4 safe-bottom">
          <Button fullWidth onClick={handleContinue}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
