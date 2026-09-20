import { useId, type ComponentProps } from 'react';

// ComponentProps (not InputHTMLAttributes) so `ref` reaches the <input> —
// React 19 passes it as an ordinary prop.
interface TextInputProps extends ComponentProps<'input'> {
  label?: string;
}

export function TextInput({ label, className = '', id, ...props }: TextInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="eyebrow block mb-2">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-4 py-3.5 rounded-[12px] border border-border bg-page text-body outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${className}`}
        {...props}
      />
    </div>
  );
}
