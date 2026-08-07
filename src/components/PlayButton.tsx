interface PlayButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function PlayButton({ onClick, disabled }: PlayButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
        disabled ? 'opacity-40 bg-primary' : 'bg-primary active:bg-primary-dark'
      }`}
      aria-label="Start practice"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>
  );
}
