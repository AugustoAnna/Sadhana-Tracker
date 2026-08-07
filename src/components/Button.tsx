import { type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text';
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base = 'px-6 py-3.5 rounded-xl font-semibold text-body transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-11';
  const variants = {
    primary: 'bg-primary text-white active:bg-primary-dark',
    secondary: 'bg-page text-primary border-2 border-primary',
    text: 'bg-transparent text-header underline-offset-2',
  };
  const width = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${base} ${variants[variant]} ${width} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
