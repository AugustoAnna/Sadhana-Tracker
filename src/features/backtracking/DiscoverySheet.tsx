import { BottomSheet, Button, PracticeIllustration } from '@/components';
import type { SheetCloseReason } from '@/components/BottomSheet';
import { COPY } from '@/copy/strings';

export type DiscoveryDismissal = 'button' | SheetCloseReason;

const copy = COPY.tracker.discovery;

/** One-time "Log yesterday" tip for people who set up before backtracking shipped. */
export function DiscoverySheet({
  open,
  onDismiss,
}: {
  open: boolean;
  onDismiss: (via: DiscoveryDismissal) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onDismiss} swipeToDismiss>
      <div className="flex flex-col items-center text-center">
        <div className="rounded-[20px] overflow-hidden">
          <PracticeIllustration practiceId="guru-pooja" size={96} />
        </div>
        <h2 className="font-serif text-ink mt-4" style={{ fontSize: '20px' }}>{copy.title}</h2>
        <p className="text-secondary mt-2 mb-6" style={{ fontSize: '14.5px' }}>{copy.body}</p>
        <Button fullWidth onClick={() => onDismiss('button')}>{copy.gotIt}</Button>
      </div>
    </BottomSheet>
  );
}
