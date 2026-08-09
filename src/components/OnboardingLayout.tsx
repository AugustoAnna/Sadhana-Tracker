import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface OnboardingLayoutProps {
  children: ReactNode;
  showBack?: boolean;
  backTo?: string;
  footer?: ReactNode;
}

export function OnboardingLayout({ children, showBack = false, backTo, footer }: OnboardingLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full bg-page">
      {showBack && (
        <div className="px-4 pt-12">
          <button
            onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
            className="w-11 h-11 flex items-center justify-center -ml-2"
            aria-label="Go back"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4">
        {!showBack && <div className="pt-14" />}
        {children}
      </div>
      {footer && (
        <div className="shrink-0 px-4 pb-4 safe-bottom sticky bottom-0 bg-page border-t border-hairline pt-3">
          {footer}
        </div>
      )}
    </div>
  );
}

interface OnboardingOptionProps {
  label: string;
  selected?: boolean;
  onClick: () => void;
}

export function OnboardingOption({ label, selected, onClick }: OnboardingOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full py-4 px-4 rounded-[14px] text-left text-body border-2 transition-colors ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-hairline bg-card'
      }`}
    >
      {label}
    </button>
  );
}
