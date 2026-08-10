import { useNavigate } from 'react-router-dom';
import { Button, PracticeIllustration } from '@/components';

const WELCOME_IDS = ['isha-kriya', 'mahamantra', 'shambhavi', 'nadi-shuddhi', 'yoga-namaskar'];

export function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full bg-page">
      <div className="flex-1 flex flex-col px-4 pt-12 pb-6">
        <div className="relative flex-1 flex items-center justify-center min-h-[45vh] mb-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <PracticeIllustration practiceId={WELCOME_IDS[0]} size={120} />
          </div>
          <div className="absolute top-8 left-6 opacity-90">
            <PracticeIllustration practiceId={WELCOME_IDS[1]} size={64} />
          </div>
          <div className="absolute top-12 right-8 opacity-85">
            <PracticeIllustration practiceId={WELCOME_IDS[2]} size={56} />
          </div>
          <div className="absolute bottom-16 left-10 opacity-80">
            <PracticeIllustration practiceId={WELCOME_IDS[3]} size={48} />
          </div>
          <div className="absolute bottom-12 right-6 opacity-80">
            <PracticeIllustration practiceId={WELCOME_IDS[4]} size={52} />
          </div>
        </div>

        <h1 className="font-serif text-display text-center mb-3">
          Your sadhana, in one place.
        </h1>
        <p className="text-label text-secondary text-center mb-8">
          Track what you practice.
        </p>
      </div>

      <div className="px-4 pb-4 safe-bottom">
        <Button fullWidth onClick={() => navigate('/welcome/name')}>
          Get started
        </Button>
      </div>
    </div>
  );
}
