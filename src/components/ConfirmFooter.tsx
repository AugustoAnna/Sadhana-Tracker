import { useEffect, useRef, useState } from 'react';

interface ConfirmFooterProps {
  count: number;
  label?: string;
  disabled?: boolean;
  onClick: () => void;
}

export function ConfirmFooter({ count, label = 'Save', disabled, onClick }: ConfirmFooterProps) {
  const prevCount = useRef(count);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (count > prevCount.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      prevCount.current = count;
      return () => clearTimeout(t);
    }
    prevCount.current = count;
  }, [count]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-page/95 backdrop-blur-sm border-t border-hairline px-4 py-3 safe-bottom z-50">
      <p
        className={`text-center text-meta mb-2 transition-all duration-300 ${
          pulse
            ? 'text-primary font-semibold scale-105'
            : 'text-secondary font-normal scale-100'
        }`}
      >
        {count} {count === 1 ? 'practice' : 'practices'} added
      </p>
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full py-3.5 min-h-11 rounded-xl bg-primary text-white font-semibold text-body disabled:opacity-40"
      >
        {label}
      </button>
    </div>
  );
}
