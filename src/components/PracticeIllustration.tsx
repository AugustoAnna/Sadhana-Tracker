/** Deterministic spot art per practice — stand-ins until designer assets land. */

const PALETTE = [
  { bg: '#E8F3F1', fg: '#0D8A7A' },
  { bg: '#F3EDE3', fg: '#8A7132' },
  { bg: '#F5E8E0', fg: '#C6530F' },
  { bg: '#E9EFE8', fg: '#5A7A4A' },
  { bg: '#EDE8F3', fg: '#6B5B7A' },
  { bg: '#F0EBE4', fg: '#7D6B42' },
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

type Glyph = 'lotus' | 'flame' | 'wave' | 'circle' | 'sun' | 'seed';

function glyphFor(id: string): Glyph {
  const glyphs: Glyph[] = ['lotus', 'flame', 'wave', 'circle', 'sun', 'seed'];
  return glyphs[hashId(id) % glyphs.length];
}

function GlyphSvg({ glyph, color }: { glyph: Glyph; color: string }) {
  switch (glyph) {
    case 'lotus':
      return (
        <g fill={color}>
          <ellipse cx="20" cy="24" rx="5" ry="8" opacity="0.9" />
          <ellipse cx="13" cy="22" rx="4" ry="7" transform="rotate(-35 13 22)" opacity="0.75" />
          <ellipse cx="27" cy="22" rx="4" ry="7" transform="rotate(35 27 22)" opacity="0.75" />
          <circle cx="20" cy="14" r="3" opacity="0.85" />
        </g>
      );
    case 'flame':
      return (
        <path
          d="M20 8 C14 16 12 20 12 24 C12 29 15.5 32 20 32 C24.5 32 28 29 28 24 C28 20 26 16 20 8Z"
          fill={color}
        />
      );
    case 'wave':
      return (
        <g fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
          <path d="M8 18 C12 14 16 14 20 18 C24 22 28 22 32 18" />
          <path d="M8 24 C12 20 16 20 20 24 C24 28 28 28 32 24" />
        </g>
      );
    case 'sun':
      return (
        <g>
          <circle cx="20" cy="20" r="6" fill={color} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const r = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={20 + Math.cos(r) * 9}
                y1={20 + Math.sin(r) * 9}
                x2={20 + Math.cos(r) * 13}
                y2={20 + Math.sin(r) * 13}
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      );
    case 'seed':
      return (
        <g fill={color}>
          <ellipse cx="20" cy="22" rx="7" ry="10" />
          <path d="M20 12 V32" stroke="#F2EFE7" strokeWidth="1.5" opacity="0.6" />
        </g>
      );
    default:
      return (
        <g fill="none" stroke={color} strokeWidth="2">
          <circle cx="20" cy="20" r="9" />
          <circle cx="20" cy="20" r="4" fill={color} stroke="none" />
        </g>
      );
  }
}

interface PracticeIllustrationProps {
  practiceId?: string;
  size?: number;
}

export function PracticeIllustration({ practiceId = 'default', size = 40 }: PracticeIllustrationProps) {
  const palette = PALETTE[hashId(practiceId) % PALETTE.length];
  const glyph = glyphFor(practiceId);

  return (
    <div
      className="rounded-[8px] flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size, backgroundColor: palette.bg }}
      aria-hidden
    >
      <svg viewBox="0 0 40 40" width={size * 0.72} height={size * 0.72}>
        <GlyphSvg glyph={glyph} color={palette.fg} />
      </svg>
    </div>
  );
}
