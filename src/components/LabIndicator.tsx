import { APP_ENV } from '@/config/environment';

export function LabIndicator() {
  if (APP_ENV !== 'lab') return null;

  return (
    <div
      className="fixed right-2 z-[60] px-2 py-1 rounded bg-journey text-white text-meta tracking-wide pointer-events-none opacity-90"
      style={{ top: 'max(env(safe-area-inset-top, 0px), 2px)' }}
      aria-hidden="true"
    >
      LAB
    </div>
  );
}
