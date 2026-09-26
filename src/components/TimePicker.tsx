import { useState, useRef, useEffect } from 'react';

interface TimePickerProps {
  value: string; // HH:mm 24h
  onChange: (time: string) => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PERIODS = ['AM', 'PM'];

function parseTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return { hour: hour12, minute: m, period };
}

function to24h(hour: number, minute: number, period: string): string {
  let h = hour % 12;
  if (period === 'PM') h += 12;
  return `${h.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function Wheel({ items, selected, onSelect, label }: {
  items: (string | number)[];
  selected: string | number;
  onSelect: (item: string | number) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const idx = items.indexOf(selected);
    if (ref.current && idx >= 0) {
      ref.current.scrollTop = idx * 40;
    }
  }, [selected, items]);

  return (
    <div className="flex-1 relative">
      <div
        ref={ref}
        className="h-40 overflow-y-auto no-scrollbar snap-y snap-mandatory"
        onScroll={(e) => {
          const idx = Math.round(e.currentTarget.scrollTop / 40);
          if (items[idx] !== undefined) onSelect(items[idx]);
        }}
      >
        <div className="py-[60px]">
          {items.map((item) => (
            <div
              key={item}
              className={`h-10 flex items-center justify-center snap-center text-lg ${
                item === selected ? 'font-bold text-gray-900 dark:text-ink' : 'text-gray-400 dark:text-faint'
              }`}
            >
              {typeof item === 'number' ? item.toString().padStart(2, '0') : item}
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  const parsed = parseTime(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState(parsed.period);

  useEffect(() => {
    onChange(to24h(hour, minute, period));
  }, [hour, minute, period]);

  return (
    <div className="bg-field rounded-xl p-2 flex gap-1 relative">
      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-10 bg-field-highlight rounded-lg pointer-events-none" />
      <Wheel items={HOURS} selected={hour} onSelect={(v) => setHour(v as number)} label="Hour" />
      <Wheel items={MINUTES} selected={minute} onSelect={(v) => setMinute(v as number)} label="Minute" />
      <Wheel items={PERIODS} selected={period} onSelect={(v) => setPeriod(v as string)} label="Period" />
    </div>
  );
}
