import { type InputHTMLAttributes } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function TextInput({ label, className = '', ...props }: TextInputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="eyebrow block mb-2">
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-3.5 rounded-[12px] border border-border bg-page text-body outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${className}`}
        {...props}
      />
    </div>
  );
}
