import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { DEMO_STATES, type DemoStateId } from '@/services/demoMode';
import { BottomSheet } from './BottomSheet';

interface DemoModePickerProps {
  open: boolean;
  onClose: () => void;
}

export function DemoModePicker({ open, onClose }: DemoModePickerProps) {
  const navigate = useNavigate();
  const enterDemoMode = useAppStore((s) => s.enterDemoMode);

  const handleSelect = async (stateId: DemoStateId) => {
    await enterDemoMode(stateId);
    onClose();

    if (stateId === 'setup-from-start') {
      navigate('/onboarding/name', { replace: true });
    } else {
      navigate('/practice-home', { replace: true });
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Demo mode">
      <p className="text-sm text-secondary mb-4">
        Preview app states without changing your real data.
      </p>
      <div className="space-y-2">
        {DEMO_STATES.map((state) => (
          <button
            key={state.id}
            type="button"
            onClick={() => handleSelect(state.id)}
            className="w-full text-left p-3 rounded-xl border border-border hover:bg-cream/50"
          >
            <p className="font-semibold text-sm">{state.label}</p>
            <p className="text-xs text-secondary mt-0.5">{state.description}</p>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

export function useDemoModeEntry(onOpen: () => void, holdMs = 5000) {
  const timerRef = useRef<number | null>(null);

  return {
    onPointerDown: () => {
      timerRef.current = window.setTimeout(onOpen, holdMs);
    },
    onPointerUp: () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    onPointerLeave: () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    onPointerCancel: () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
  };
}
