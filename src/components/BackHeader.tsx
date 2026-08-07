import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface BackHeaderProps {
  title?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  dark?: boolean;
}

export function BackHeader({ title, onBack, rightAction, dark = false }: BackHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className={`flex items-center gap-3 px-4 pt-12 pb-4 ${dark ? 'bg-header text-white' : ''}`}>
      <button
        onClick={onBack ?? (() => navigate(-1))}
        className="w-10 h-10 flex items-center justify-center -ml-2"
        aria-label="Go back"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      {title && (
        <h1 className={`font-serif text-2xl font-semibold flex-1 ${dark ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h1>
      )}
      {rightAction && <div className="ml-auto">{rightAction}</div>}
    </header>
  );
}
