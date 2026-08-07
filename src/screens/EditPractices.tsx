import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BackHeader, StickyAction, BottomSheet, Button, PracticeIllustration } from '@/components';
import { useAppStore } from '@/stores/appStore';
import {
  PRACTICES, COMMONLY_PRACTICED_IDS, MAX_PRACTICE_INSTANCES, getPractice,
} from '@/data/catalogue';
import type { PracticeInstance } from '@/types';

export function EditPractices() {
  const navigate = useNavigate();
  const location = useLocation();
  const firstSetup = (location.state as { firstSetup?: boolean })?.firstSetup ?? false;

  const instances = useAppStore((s) => s.instances);
  const addPracticeInstance = useAppStore((s) => s.addPracticeInstance);
  const removePracticeInstance = useAppStore((s) => s.removePracticeInstance);
  const profile = useAppStore((s) => s.profile);
  const markEducationShown = useAppStore((s) => s.markInstanceEducationShown);
  const showToast = useAppStore((s) => s.showToast);

  const [addedOpen, setAddedOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  const [educationOpen, setEducationOpen] = useState(false);
  const [pendingAdds, setPendingAdds] = useState<PracticeInstance[]>([]);

  const allInstances = [...instances, ...pendingAdds];
  const atCap = allInstances.length >= MAX_PRACTICE_INSTANCES;

  const getInstanceCount = (practiceId: string) =>
    allInstances.filter((i) => i.practiceId === practiceId).length;

  const handleAdd = async (practiceId: string) => {
    if (atCap) return;
    const count = getInstanceCount(practiceId);
    if (count >= 2) return;

    const instance = await addPracticeInstance(practiceId);
    if (instance) {
      setPendingAdds((prev) => [...prev, instance]);

      if (allInstances.length === 0 && !profile?.instanceEducationShown) {
        setEducationOpen(true);
      }
    }
  };

  const handleRemove = async (instanceId: string) => {
    await removePracticeInstance(instanceId);
    setPendingAdds((prev) => prev.filter((i) => i.id !== instanceId));
  };

  const handleDone = () => {
    if (firstSetup) {
      navigate('/reminders', { state: { firstSetup: true } });
    } else {
      showToast('Changes saved');
      navigate('/practice-home');
    }
  };

  const commonlyPracticed = COMMONLY_PRACTICED_IDS
    .map((id) => getPractice(id))
    .filter(Boolean);

  const otherPractices = PRACTICES
    .filter((p) => !COMMONLY_PRACTICED_IDS.includes(p.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto pb-24">
        <BackHeader title="Add practices" />
        <p className="px-4 text-sm text-secondary mb-4">
          Select the practices you have learnt and are currently practicing.
        </p>

        {/* Added section */}
        {allInstances.length > 0 && (
          <div className="px-4 mb-4">
            <button
              onClick={() => setAddedOpen(!addedOpen)}
              className="flex items-center gap-2 w-full py-2 font-semibold"
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-transform ${addedOpen ? 'rotate-90' : ''}`}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              Added ({allInstances.length})
            </button>
            {addedOpen && allInstances.map((inst) => {
              const p = getPractice(inst.practiceId);
              if (!p) return null;
              return (
                <div key={inst.id} className="flex items-center gap-3 py-3 border-b border-border">
                  <PracticeIllustration />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted">
                      {inst.instanceNumber === 1 ? '1st' : '2nd'} instance
                    </p>
                  </div>
                  <button onClick={() => handleRemove(inst.id)} className="text-error">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Commonly practiced */}
        <div className="px-4 mb-4">
          <h3 className="font-semibold mb-2">Commonly practiced</h3>
          {commonlyPracticed.map((p) => p && (
            <PracticeAddRow
              key={p.id}
              name={p.name}
              instanceCount={getInstanceCount(p.id)}
              atCap={atCap}
              onAdd={() => handleAdd(p.id)}
            />
          ))}
        </div>

        {/* All other */}
        <div className="px-4 mb-4">
          <button
            onClick={() => setOtherOpen(!otherOpen)}
            className="flex items-center gap-2 w-full py-2 font-semibold"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`transition-transform ${otherOpen ? 'rotate-90' : ''}`}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            All other practices (A–Z)
          </button>
          {otherOpen && otherPractices.map((p) => (
            <PracticeAddRow
              key={p.id}
              name={p.name}
              instanceCount={getInstanceCount(p.id)}
              atCap={atCap}
              onAdd={() => handleAdd(p.id)}
            />
          ))}
        </div>

        {atCap && (
          <p className="px-4 text-sm text-secondary text-center">
            Maximum of {MAX_PRACTICE_INSTANCES} practices reached.
          </p>
        )}
      </div>

      <StickyAction
        label="Add practices"
        count={allInstances.length}
        disabled={allInstances.length === 0}
        onClick={handleDone}
      />

      <BottomSheet open={educationOpen} onClose={() => {
        setEducationOpen(false);
        markEducationShown();
      }} title="Practice twice a day?">
        <p className="text-secondary mb-4">
          You can add the same practice twice if you do it morning and evening.
          Look for the add button on the practice in the list below.
        </p>
        <Button fullWidth onClick={() => {
          setEducationOpen(false);
          markEducationShown();
        }}>
          Got it
        </Button>
      </BottomSheet>
    </div>
  );
}

function PracticeAddRow({
  name,
  instanceCount,
  atCap,
  onAdd,
}: {
  name: string;
  instanceCount: number;
  atCap: boolean;
  onAdd: () => void;
}) {
  const showSecond = instanceCount === 1;
  const hidden = instanceCount >= 2;
  const opacity = instanceCount === 1 ? 'opacity-50' : '';

  if (hidden) return null;

  return (
    <div className={`flex items-center gap-3 py-3 border-b border-border ${opacity}`}>
      <PracticeIllustration />
      <div className="flex-1">
        <p className="font-medium text-sm">{name}</p>
        {showSecond && <p className="text-xs text-muted">2nd instance</p>}
      </div>
      <button
        onClick={onAdd}
        disabled={atCap}
        className="w-8 h-8 rounded-lg border-2 border-primary text-primary font-bold flex items-center justify-center disabled:opacity-30"
        aria-label={`Add ${name}`}
      >
        +
      </button>
    </div>
  );
}
