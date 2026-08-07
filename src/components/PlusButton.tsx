interface PlusButtonProps {
  onClick: () => void;
  totalMinutes?: number;
}

export function PlusButton({ onClick, totalMinutes }: PlusButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center flex-shrink-0"
      aria-label="Add minutes"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D8A7A" strokeWidth="2.5">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {totalMinutes !== undefined && totalMinutes > 0 && (
        <span className="absolute -bottom-1 -right-1 bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {totalMinutes > 99 ? '99+' : totalMinutes}
        </span>
      )}
    </button>
  );
}
