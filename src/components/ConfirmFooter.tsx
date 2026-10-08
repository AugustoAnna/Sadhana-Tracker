interface ConfirmFooterProps {
  /** Shown after the label, e.g. "Save (3)"; hidden at 0. */
  count: number;
  label?: string;
  disabled?: boolean;
  onClick: () => void;
}

export function ConfirmFooter({ count, label = 'Save', disabled, onClick }: ConfirmFooterProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-page/95 backdrop-blur-sm border-t border-hairline px-4 py-3 safe-bottom z-50">
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full py-3.5 min-h-11 rounded-xl bg-primary text-white font-semibold text-body disabled:opacity-40"
      >
        {count > 0 ? `${label} (${count})` : label}
      </button>
    </div>
  );
}
