interface ConfirmFooterProps {
  count: number;
  label?: string;
  disabled?: boolean;
  onClick: () => void;
}

export function ConfirmFooter({ count, label = 'Confirm', disabled, onClick }: ConfirmFooterProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-page/95 backdrop-blur-sm border-t border-hairline px-4 py-3 safe-bottom z-50">
      <p
        key={count}
        className="text-center text-meta text-secondary mb-2 animate-[scale-bump_0.3s_ease-out]"
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
