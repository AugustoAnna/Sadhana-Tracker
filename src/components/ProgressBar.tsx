interface ProgressBarProps {
  progress: number; // 0-1
  className?: string;
}

export function ProgressBar({ progress, className = '' }: ProgressBarProps) {
  return (
    <div className={`h-1.5 bg-sunken rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-journey rounded-full transition-all duration-700 ease-out"
        style={{ width: `${Math.min(100, progress * 100)}%` }}
      />
    </div>
  );
}
