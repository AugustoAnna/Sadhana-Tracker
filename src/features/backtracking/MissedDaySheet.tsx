import { BottomSheet, Button, PracticeIllustration } from '@/components';
import { COPY } from '@/copy/strings';
import type { MissedVariant } from './missedDayRule';

export type MissedDayAnswer = 'log' | 'didnt' | 'dismiss';

const copy = COPY.tracker.missedDay;

function titleFor(variant: MissedVariant, name: string): string {
  if (variant === 1) return copy.title1;
  if (variant === 2) return name ? copy.title2Named(name) : copy.title2;
  return copy.title3;
}

const BODY: Record<MissedVariant, string> = { 1: copy.body1, 2: copy.body2, 3: copy.body3 };

/** "Did you practice yesterday?" — the way back into Yesterday after a gap. */
export function MissedDaySheet({
  open,
  variant,
  name,
  onAnswer,
}: {
  open: boolean;
  variant: MissedVariant;
  name: string;
  onAnswer: (answer: MissedDayAnswer) => void;
}) {
  return (
    <BottomSheet open={open} onClose={() => onAnswer('dismiss')} swipeToDismiss>
      <div className="flex flex-col items-center text-center">
        <div className="rounded-[20px] overflow-hidden">
          <PracticeIllustration practiceId="shambhavi" size={96} />
        </div>
        <h2 className="font-serif text-ink mt-4" style={{ fontSize: '20px' }}>{titleFor(variant, name)}</h2>
        <p className="text-secondary mt-2 mb-6" style={{ fontSize: '14.5px' }}>{BODY[variant]}</p>
        <Button fullWidth onClick={() => onAnswer('log')}>{copy.logYesterday}</Button>
        <button
          type="button"
          onClick={() => onAnswer('didnt')}
          className="mt-2 min-h-11 px-4 font-semibold text-primary"
        >
          {copy.didntPractice}
        </button>
      </div>
    </BottomSheet>
  );
}
