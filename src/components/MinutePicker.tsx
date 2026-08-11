import { useState, useEffect, useRef, useCallback } from 'react';

const MINUTES = Array.from({ length: 36 }, (_, i) => (i + 1) * 5);
const ROW_HEIGHT = 40;
const PADDING = 60;

interface MinutePickerProps {
  initialValue: number;
  onChange: (minutes: number) => void;
}

export function MinutePicker({ initialValue, onChange }: MinutePickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [selected, setSelected] = useState(initialValue);
  const userScrolling = useRef(false);

  const indexForMinute = (m: number) => {
    const idx = MINUTES.indexOf(m);
    return idx >= 0 ? idx : 0;
  };

  const scrollToIndex = useCallback((idx: number, behavior: ScrollBehavior = 'auto') => {
    scrollRef.current?.scrollTo({ top: idx * ROW_HEIGHT, behavior });
  }, []);

  useEffect(() => {
    setSelected(initialValue);
    requestAnimationFrame(() => scrollToIndex(indexForMinute(initialValue)));
  }, [initialValue, scrollToIndex]);

  const settleSelection = useCallback(() => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollTop / ROW_HEIGHT);
    const clamped = Math.max(0, Math.min(MINUTES.length - 1, idx));
    const m = MINUTES[clamped];
    setSelected(m);
    onChangeRef.current(m);
    scrollToIndex(clamped);
    userScrolling.current = false;
  }, [scrollToIndex]);

  return (
    <div className="bg-gray-100 rounded-xl p-2 relative">
      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-10 bg-white/60 rounded-lg pointer-events-none z-10" />
      <div
        ref={scrollRef}
        className="h-40 overflow-y-auto no-scrollbar snap-y snap-mandatory"
        style={{ scrollPaddingTop: PADDING, scrollPaddingBottom: PADDING }}
        onScroll={() => {
          userScrolling.current = true;
        }}
        onTouchEnd={() => userScrolling.current && settleSelection()}
        onMouseUp={() => userScrolling.current && settleSelection()}
      >
        <div style={{ paddingTop: PADDING, paddingBottom: PADDING }}>
          {MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setSelected(m);
                onChangeRef.current(m);
                scrollToIndex(indexForMinute(m), 'smooth');
              }}
              className={`w-full flex items-center justify-center text-lg snap-center ${
                m === selected ? 'font-bold text-gray-900' : 'text-gray-400'
              }`}
              style={{ height: ROW_HEIGHT }}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
