import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';

export function DemoModeIndicator() {
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const exitDemoMode = useAppStore((s) => s.exitDemoMode);
  const navigate = useNavigate();

  if (!isDemoMode) return null;

  const handleExit = async () => {
    await exitDemoMode();
    navigate('/practice-home', { replace: true });
  };

  return (
    <button
      type="button"
      onClick={handleExit}
      className="fixed top-2 right-2 z-[60] px-2.5 py-1 rounded-full bg-black/70 text-white text-[10px] font-semibold tracking-wide uppercase pointer-events-auto"
      aria-label="Exit demo mode"
    >
      Demo · tap to exit
    </button>
  );
}
