import { type InputHTMLAttributes } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function TextInput({ label, className = '', ...props }: TextInputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-[11px] font-semibold tracking-widest text-secondary uppercase mb-2">
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-3.5 rounded-xl border-2 border-primary bg-white/80 text-base outline-none focus:ring-2 focus:ring-primary/30 ${className}`}
        {...props}
      />
    </div>
  );
}
