import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';

export function SetupReplayPanel() {
  const navigate = useNavigate();
  const resetForSetupReplay = useAppStore((s) => s.resetForSetupReplay);
  const resetToEmptyStatePreview = useAppStore((s) => s.resetToEmptyStatePreview);

  const handleFullReplay = async () => {
    await resetForSetupReplay();
    navigate('/onboarding/name', { replace: true });
  };

  const handleEmptyPreview = async () => {
    await resetToEmptyStatePreview();
    navigate('/practice-home', { replace: true });
  };

  return (
    <div className="mx-4 mt-8 mb-6 p-4 rounded-xl border border-dashed border-border bg-white/60">
      <p className="text-xs font-semibold tracking-widest text-secondary uppercase mb-3">
        Review flows
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={handleFullReplay}
          className="w-full py-3 px-4 rounded-lg bg-header text-white text-sm font-medium text-left active:opacity-90"
        >
          Replay full setup
          <span className="block text-xs text-white/60 font-normal mt-0.5">
            Onboarding → empty state → add practices
          </span>
        </button>
        <button
          onClick={handleEmptyPreview}
          className="w-full py-3 px-4 rounded-lg border border-border bg-white text-sm font-medium text-left active:bg-gray-50"
        >
          Preview empty state
          <span className="block text-xs text-secondary font-normal mt-0.5">
            Skip onboarding, animate empty practice home
          </span>
        </button>
      </div>
    </div>
  );
}
