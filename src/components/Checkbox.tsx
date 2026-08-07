import { useState } from 'react';

interface CheckboxProps {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}

export function Checkbox({ checked, disabled, onChange }: CheckboxProps) {
  const [rippling, setRippling] = useState(false);

  const handleClick = () => {
    if (disabled || checked) return;
    setRippling(true);
    onChange();
    setTimeout(() => setRippling(false), 500);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || checked}
      className="relative w-6 h-6 flex-shrink-0"
      aria-label={checked ? 'Completed' : 'Mark complete'}
    >
      <div
        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
          checked ? 'bg-primary border-primary' : 'border-border bg-white'
        } ${disabled && !checked ? 'opacity-40' : ''}`}
      >
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 24,
                strokeDashoffset: 0,
                animation: 'check-tick 0.3s ease-out forwards',
              }}
            />
          </svg>
        )}
      </div>
      {rippling && (
        <div className="absolute inset-0 rounded-md border-2 border-primary checkbox-ripple pointer-events-none" />
      )}
    </button>
  );
}
