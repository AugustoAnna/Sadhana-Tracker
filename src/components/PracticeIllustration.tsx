export function PracticeIllustration({ size = 40 }: { size?: number }) {
  return (
    <div
      className="rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 40 40" width={size * 0.7} height={size * 0.7}>
        <circle cx="20" cy="12" r="5" fill="#C4A882" />
        <path d="M20 17 C12 22 10 30 20 36 C30 30 28 22 20 17Z" fill="#0D8A7A" opacity="0.7" />
      </svg>
    </div>
  );
}
