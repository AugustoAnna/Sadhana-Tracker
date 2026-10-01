import { COPY } from '@/copy/strings';
import type { DayKey } from './types';

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  );
}

/**
 * ‹ Today › — moves practice home between today and yesterday. The label is
 * the only cue for which day the screen shows, so it is announced on change.
 * The inactive chevron stays focusable (aria-disabled) so the control keeps a
 * stable tab order.
 */
export function DaySwitcher({ day, onChange }: { day: DayKey; onChange: (day: DayKey) => void }) {
  const onToday = day === 'today';
  return (
    // A card like the stat cards below, chevrons at its edges.
    <div className="flex items-center justify-between bg-card rounded-[14px] border border-hairline px-1 text-ink">
      <button
        type="button"
        aria-label={COPY.tracker.day.showYesterday}
        aria-disabled={!onToday}
        onClick={() => onToday && onChange('yesterday')}
        className={`w-11 h-11 flex items-center justify-center ${onToday ? '' : 'opacity-[.28]'}`}
      >
        <Chevron direction="left" />
      </button>
      <p aria-live="polite" className="flex-1 text-center text-[16px] font-semibold">
        {onToday ? COPY.tracker.day.today : COPY.tracker.day.yesterday}
      </p>
      <button
        type="button"
        aria-label={COPY.tracker.day.showToday}
        aria-disabled={onToday}
        onClick={() => !onToday && onChange('today')}
        className={`w-11 h-11 flex items-center justify-center ${onToday ? 'opacity-[.28]' : ''}`}
      >
        <Chevron direction="right" />
      </button>
    </div>
  );
}
