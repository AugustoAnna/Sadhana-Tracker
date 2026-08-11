import { useRef, useState, useEffect, useCallback } from 'react';

const MINUTES = Array.from({ length: 36 }, (_, i) => (i + 1) * 5);
const ROW_HEIGHT = 40;

interface MinutePickerProps {
  initialValue: number;
  onChange: (minutes: number) => void;
}

export function MinutePicker({ initialValue, onChange }: MinutePickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState(initialValue);

  const scrollToMinute = useCallback((minutes: number, smooth = false) => {
    const idx = MINUTES.indexOf(minutes);
    if (idx < 0 || !scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: idx * ROW_HEIGHT,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  useEffect(() => {
    setSelected(initialValue);
    requestAnimationFrame(() => scrollToMinute(initialValue));
  }, [initialValue, scrollToMinute]);

  const settle = useCallback((scrollTop: number) => {
    const idx = Math.round(scrollTop / ROW_HEIGHT);
    const clamped = Math.max(0, Math.min(MINUTES.length - 1, idx));
    const m = MINUTES[clamped];
    setSelected(m);
    onChange(m);
    scrollToMinute(m);
    scrollingRef.current = false;
  }, [onChange, scrollToMinute]);

  const handleScroll = () => {
    scrollingRef.current = true;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (scrollRef.current) settle(scrollRef.current.scrollTop);
    }, 80);
  };

  const selectMinute = (m: number) => {
    setSelected(m);
    onChange(m);
    scrollToMinute(m, true);
  };

  return (
    <div className="bg-gray-100 rounded-xl p-2 relative">
      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-10 bg-white/60 rounded-lg pointer-events-none z-10" />
      <div
        ref={scrollRef}
        className="h-40 overflow-y-auto no-scrollbar"
        onScroll={handleScroll}
        onTouchEnd={() => scrollRef.current && settle(scrollRef.current.scrollTop)}
        onMouseUp={() => scrollRef.current && settle(scrollRef.current.scrollTop)}
      >
        <div className="py-[60px]">
          {MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => selectMinute(m)}
              className={`w-full h-10 flex items-center justify-center text-lg snap-center ${
                m === selected ? 'font-bold text-gray-900' : 'text-gray-400'
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
