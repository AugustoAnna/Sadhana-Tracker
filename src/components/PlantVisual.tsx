interface PlantVisualProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animating?: boolean;
}

const SIZES = { sm: 32, md: 48, lg: 80 };

export function PlantVisual({ level, size = 'md', className = '', animating }: PlantVisualProps) {
  const px = SIZES[size];
  const growth = Math.min(level, 16) / 16;

  return (
    <div
      className={`flex items-center justify-center ${animating ? 'plant-settle' : ''} ${className}`}
      style={{ width: px, height: px }}
      aria-label={`Level ${level} plant`}
    >
      <svg viewBox="0 0 48 48" width={px} height={px}>
        {/* Pot */}
        <rect x="14" y="36" width="20" height="8" rx="2" fill="#C4A882" />
        {/* Stem */}
        <rect
          x="23"
          y={36 - growth * 20}
          width="2"
          height={growth * 20}
          fill="#4A7C3F"
        />
        {/* Leaves */}
        {level > 0 && (
          <>
            <ellipse
              cx="18"
              cy={30 - growth * 8}
              rx={4 + growth * 4}
              ry={3 + growth * 3}
              fill="#5A9E4F"
              transform={`rotate(-30 18 ${30 - growth * 8})`}
            />
            <ellipse
              cx="30"
              cy={28 - growth * 10}
              rx={4 + growth * 4}
              ry={3 + growth * 3}
              fill="#6BB85A"
              transform={`rotate(30 30 ${28 - growth * 10})`}
            />
          </>
        )}
        {/* Seed for level 0 */}
        {level === 0 && (
          <ellipse cx="24" cy="32" rx="6" ry="4" fill="#8B6914" />
        )}
      </svg>
    </div>
  );
}
