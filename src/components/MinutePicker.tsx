import { useState, useRef, useEffect } from 'react';

const MINUTES = Array.from({ length: 36 }, (_, i) => (i + 1) * 5);

interface MinutePickerProps {
  value: number;
  onChange: (minutes: number) => void;
}

export function MinutePicker({ value, onChange }: MinutePickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(value || 5);

  useEffect(() => {
    const idx = MINUTES.indexOf(selected);
    if (ref.current && idx >= 0) {
      ref.current.scrollTop = idx * 40;
    }
  }, []);

  return (
    <div>
      <p className="text-sm text-secondary text-center mb-4">
        This value applies per session of this practice.
      </p>
      <div className="bg-gray-100 rounded-xl p-2 relative">
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-10 bg-white/60 rounded-lg pointer-events-none" />
        <div
          ref={ref}
          className="h-40 overflow-y-auto no-scrollbar snap-y snap-mandatory"
          onScroll={(e) => {
            const idx = Math.round(e.currentTarget.scrollTop / 40);
            if (MINUTES[idx] !== undefined) {
              setSelected(MINUTES[idx]);
              onChange(MINUTES[idx]);
            }
          }}
        >
          <div className="py-[60px]">
            {MINUTES.map((m) => (
              <div
                key={m}
                className={`h-10 flex items-center justify-center snap-center text-lg ${
                  m === selected ? 'font-bold text-gray-900' : 'text-gray-400'
                }`}
              >
                {m} min
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
