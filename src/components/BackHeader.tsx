import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface BackHeaderProps {
  title?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  dark?: boolean;
  hideBack?: boolean;
  /** Less space above the title, matching the home header. */
  compact?: boolean;
}

export function BackHeader({ title, onBack, rightAction, dark = false, hideBack = false, compact = false }: BackHeaderProps) {
  const navigate = useNavigate();

  return (
    <header
      className={`flex items-center gap-2 px-4 ${dark ? 'pt-6 pb-2' : compact ? 'pt-3 pb-3' : 'pt-10 pb-3'} ${
        dark
          ? 'bg-header text-white'
          : 'bg-page text-ink'
      }`}
    >
      {!hideBack ? (
        <button
          onClick={onBack ?? (() => navigate(-1))}
          className="w-11 h-11 flex items-center justify-center -ml-2 rounded-full"
          aria-label="Go back"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      ) : (
        <div className="w-0" />
      )}
      {title && (
        <h1 className={`font-serif text-display flex-1 ${dark ? 'text-white' : 'text-ink'}`}>
          {title}
        </h1>
      )}
      {rightAction && <div className="ml-auto flex items-center">{rightAction}</div>}
    </header>
  );
}
