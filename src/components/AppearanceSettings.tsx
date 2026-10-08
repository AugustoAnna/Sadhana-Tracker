import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { TimePicker } from './TimePicker';
import { formatTimeDisplay } from '@/utils/dates';
import { setDarkWindow, setThemeMode, useThemeStore, type ThemeMode } from '@/services/theme';
import { track } from '@/services/instrumentation';

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
];

type Edge = 'start' | 'end';

/** Light / Dark / Auto, and in Auto the times dark mode starts and ends. */
export function AppearanceSettings() {
  const mode = useThemeStore((s) => s.mode);
  const darkWindow = useThemeStore((s) => s.darkWindow);
  const [editing, setEditing] = useState<Edge | null>(null);
  const [selectedTime, setSelectedTime] = useState(darkWindow.start);

  const choose = (value: ThemeMode) => {
    if (value === mode) return;
    void track('theme_changed', { from: mode, to: value });
    setThemeMode(value);
  };

  const openSheet = (edge: Edge) => {
    setSelectedTime(darkWindow[edge]);
    setEditing(edge);
  };

  const handleConfirm = () => {
    if (editing && selectedTime !== darkWindow[editing]) {
      const next = { ...darkWindow, [editing]: selectedTime };
      void track('dark_window_changed', { start: next.start, end: next.end });
      setDarkWindow(next);
    }
    setEditing(null);
  };

  return (
    <section>
      <p className="section-header mb-2">Appearance</p>
      <div className="bg-card rounded-[14px] px-3 divide-y divide-hairline">
        <div className="py-3">
          <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-1 p-1 rounded-[10px] bg-page">
            {MODES.map(({ value, label }) => {
              const selected = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(value)}
                  className={`min-h-11 rounded-[7px] text-body transition-colors ${
                    selected ? 'bg-card dark:bg-field text-ink shadow-sm' : 'text-secondary'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {mode === 'auto' && (
          <>
            <TimeRow label="Dark mode starts" time={darkWindow.start} onClick={() => openSheet('start')} />
            <TimeRow label="Dark mode ends" time={darkWindow.end} onClick={() => openSheet('end')} />
          </>
        )}
      </div>
      {mode === 'auto' && (
        <p className="text-label text-secondary mt-2">
          Also dark whenever your phone is in dark mode.
        </p>
      )}

      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'end' ? 'Dark mode ends' : 'Dark mode starts'}
      >
        <TimePicker value={selectedTime} onChange={setSelectedTime} />
        <Button fullWidth className="mt-4" onClick={handleConfirm}>
          Set time
        </Button>
      </BottomSheet>
    </section>
  );
}

function TimeRow({ label, time, onClick }: { label: string; time: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center justify-between w-full py-4 text-left">
      <span className="text-body">{label}</span>
      <span className="text-label text-secondary">{formatTimeDisplay(time)}</span>
    </button>
  );
}
