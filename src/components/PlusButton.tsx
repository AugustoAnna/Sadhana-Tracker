interface PlusButtonProps {
  onClick: () => void;
  totalMinutes?: number;
}

export function PlusButton({ onClick, totalMinutes }: PlusButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative w-11 h-11 flex items-center justify-center flex-shrink-0"
      aria-label="Add minutes"
    >
      <span className="w-[26px] h-[26px] rounded-[7px] border-2 border-primary flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary-text" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      {totalMinutes !== undefined && totalMinutes > 0 && (
        <span className="absolute top-0.5 right-0.5 bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {totalMinutes > 99 ? '99+' : totalMinutes}
        </span>
      )}
    </button>
  );
}
