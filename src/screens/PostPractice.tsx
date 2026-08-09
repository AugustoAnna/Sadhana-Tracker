import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components';
import { POST_PRACTICE_MIN_DURATION_MS } from '@/data/constants';

export function PostPractice() {
  const navigate = useNavigate();
  const [canContinue, setCanContinue] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setCanContinue(true), POST_PRACTICE_MIN_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => {
    navigate('/practice-home', { replace: true });
  };

  return (
    <div
      className="h-full bg-ground flex flex-col items-center justify-center relative"
      onClick={() => canContinue && handleContinue()}
    >
      <button
        onClick={handleContinue}
        className="absolute top-12 right-4 text-white/60 text-meta min-h-11 px-2"
      >
        Skip
      </button>

      <div className="w-64 h-64 bg-black/20 rounded-[12px] flex items-center justify-center">
        <p className="text-white/40 text-label text-center font-serif">Stillness<br />(TBD — placeholder image)</p>
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
