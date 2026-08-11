import { useState } from 'react';
import { resolveIllustrationUrl } from '@/data/practiceAssets';

interface PracticeIllustrationProps {
  practiceId?: string;
  size?: number;
  className?: string;
}

export function PracticeIllustration({
  practiceId = 'default',
  size = 40,
  className = '',
}: PracticeIllustrationProps) {
  const src = resolveIllustrationUrl(practiceId);
  const [failed, setFailed] = useState(false);
  const missing = !src || failed;

  if (missing) {
    return (
      <div
        className={`rounded-[8px] flex-shrink-0 bg-[#E6E4E0] ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={`rounded-[8px] object-cover flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
