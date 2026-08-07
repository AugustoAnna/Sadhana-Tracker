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
    <header
      className={`flex items-center gap-2 px-4 pt-12 pb-4 ${
        dark
          ? 'bg-header text-white'
          : 'bg-page text-ink'
      }`}
    >
      <button
        onClick={onBack ?? (() => navigate(-1))}
        className="w-11 h-11 flex items-center justify-center -ml-2 rounded-full"
        aria-label="Go back"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      {title && (
        <h1 className={`font-serif text-display flex-1 ${dark ? 'text-white' : 'text-ink'}`}>
          {title}
        </h1>
      )}
      {rightAction && <div className="ml-auto flex items-center">{rightAction}</div>}
    </header>
  );
}
