import { useNavigate } from 'react-router-dom';
import { Button, PracticeIllustration } from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { REQUIRE_EMAIL_SIGN_IN } from '@/config/environment';

/** Ring layout — central illustration larger, six around in a circle. */
const CENTER_ID = 'isha-kriya';
const RING: { id: string; angle: number; size: number; radius: number }[] = [
  { id: 'mahamantra', angle: -90, size: 52, radius: 118 },
  { id: 'shambhavi', angle: -30, size: 48, radius: 122 },
  { id: 'yoga-namaskar', angle: 30, size: 44, radius: 116 },
  { id: 'shoonya', angle: 90, size: 50, radius: 120 },
  { id: 'nadi-shuddhi', angle: 150, size: 46, radius: 118 },
  { id: 'devi-sadhana', angle: 210, size: 44, radius: 114 },
];

function polarPosition(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    left: `calc(50% + ${Math.cos(rad) * radius}px)`,
    top: `calc(50% + ${Math.sin(rad) * radius}px)`,
  };
}

export function Welcome() {
  const navigate = useNavigate();
  const signedIn = useAuthStore((s) => s.state === 'signed-in');
  const nextStep = REQUIRE_EMAIL_SIGN_IN && !signedIn ? '/sign-in' : '/welcome/name';

  return (
    <div className="flex flex-col h-full bg-page">
      <div className="flex-1 flex flex-col px-4 pt-10 pb-6">
        <div className="relative mx-auto w-full max-w-[320px] aspect-square mb-8">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <PracticeIllustration practiceId={CENTER_ID} size={100} />
          </div>
          {RING.map((item) => (
            <div
              key={item.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={polarPosition(item.angle, item.radius)}
            >
              <PracticeIllustration practiceId={item.id} size={item.size} />
            </div>
          ))}
        </div>

        <h1 className="font-serif text-display text-center mb-3">
          Your sadhana, in one place.
        </h1>
        <p className="text-label text-secondary text-center mb-8">
          Track what you practice. See it build.
        </p>
      </div>

      <div className="px-4 pb-4 safe-bottom">
        <Button fullWidth onClick={() => navigate(nextStep)}>
          Get started
        </Button>
      </div>
    </div>
  );
}
