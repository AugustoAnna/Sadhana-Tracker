import { useState } from 'react';import {
  getIllustrationFallbackUrl,
  getIllustrationUrl,
  PRACTICES_WITHOUT_ILLUSTRATION,
} from '@/data/illustrationMap';

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
  const [src, setSrc] = useState(() => getIllustrationUrl(practiceId));
  const [failed, setFailed] = useState(false);
  const missing = PRACTICES_WITHOUT_ILLUSTRATION.has(practiceId) || !src || failed;

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
      onError={() => {
        const fallback = getIllustrationFallbackUrl(practiceId);
        if (fallback && src !== fallback) {
          setSrc(fallback);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
