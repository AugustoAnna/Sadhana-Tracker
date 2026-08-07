import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BackHeader, StickyAction, BottomSheet, PracticeIllustration } from '@/components';
import { useAppStore } from '@/stores/appStore';
import {
  PRACTICES, COMMONLY_PRACTICED_IDS, MAX_PRACTICE_INSTANCES, getPractice,
} from '@/data/catalogue';
import { getInstanceOrdinalLabel } from '@/utils/instances';

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

  const [addedOpen, setAddedOpen] = useState(true);
  const [otherOpen, setOtherOpen] = useState(false);
  const [educationOpen, setEducationOpen] = useState(false);

  const atCap = instances.length >= MAX_PRACTICE_INSTANCES;

  const getInstanceCount = (practiceId: string) =>
    instances.filter((i) => i.practiceId === practiceId).length;

  const handleAdd = async (practiceId: string) => {
    if (atCap) return;
    const count = getInstanceCount(practiceId);
    if (count >= 2) return;

    const wasFirstEver = instances.length === 0;
    const shouldShowEducation = wasFirstEver && !profile?.instanceEducationShown;

    const instance = await addPracticeInstance(practiceId);
    if (!instance) return;

    if (shouldShowEducation) {
      setEducationOpen(true);
    }
  };

  const handleDismissEducation = () => {
    setEducationOpen(false);
    markEducationShown();
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
    <div className="h-full flex flex-col bg-page">
      <div className="flex-1 overflow-y-auto pb-24">
        <BackHeader title="Add practices" />
        <p className="px-4 text-label text-secondary mb-5">
          Select the practices you have learnt and are currently practicing.
        </p>

        {instances.length > 0 && (
          <div className="px-4 mb-5">
            <button
              onClick={() => setAddedOpen(!addedOpen)}
              className="flex items-center gap-2 w-full py-2 text-title"
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-transform ${addedOpen ? 'rotate-90' : ''}`}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              Added ({instances.length})
            </button>
            {addedOpen && (
              <div className="bg-card rounded-[14px] px-3 mt-1">
                {instances.map((inst) => {
                  const p = getPractice(inst.practiceId);
                  if (!p) return null;
                  const label = getInstanceOrdinalLabel(inst, instances);
                  return (
                    <div key={inst.id} className="flex items-center gap-3 py-3 border-b border-hairline last:border-0">
                      <PracticeIllustration practiceId={p.id} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="text-body truncate">{p.name}</p>
                        {label && (
                          <p className="text-label text-secondary capitalize">{label}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removePracticeInstance(inst.id)}
                        className="text-error w-11 h-11 flex items-center justify-center"
                        aria-label={`Remove ${p.name}`}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="px-4 mb-5">
          <p className="eyebrow mb-3">Commonly practiced</p>
          <div className="bg-card rounded-[14px] px-3">
            {commonlyPracticed.map((p) => p && (
              <PracticeAddRow
                key={p.id}
                practiceId={p.id}
                name={p.name}
                instanceCount={getInstanceCount(p.id)}
                atCap={atCap}
                onAdd={() => handleAdd(p.id)}
              />
            ))}
          </div>
        </div>

        <div className="px-4 mb-5">
          <button
            onClick={() => setOtherOpen(!otherOpen)}
            className="flex items-center gap-2 w-full py-2 text-title"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`transition-transform ${otherOpen ? 'rotate-90' : ''}`}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            All other practices (A–Z)
          </button>
          {otherOpen && (
            <div className="bg-card rounded-[14px] px-3 mt-1">
              {otherPractices.map((p) => (
                <PracticeAddRow
                  key={p.id}
                  practiceId={p.id}
                  name={p.name}
                  instanceCount={getInstanceCount(p.id)}
                  atCap={atCap}
                  onAdd={() => handleAdd(p.id)}
                />
              ))}
            </div>
          )}
        </div>

        {atCap && (
          <p className="px-4 text-label text-secondary text-center">
            Maximum of {MAX_PRACTICE_INSTANCES} practices reached. Remove a practice to add another.
          </p>
        )}
      </div>

      <StickyAction
        label="Add practices"
        count={instances.length}
        disabled={instances.length === 0}
        onClick={handleDone}
      />

      <BottomSheet
        open={educationOpen}
        onClose={handleDismissEducation}
        title="Practice twice a day?"
        hideCloseButton
        dismissOnBackdrop={false}
      >
        <p className="text-label text-secondary mb-6">
          You can add the same practice twice if you do it morning and evening.
          The option to add again sits in the same place you just tapped.
        </p>
        <button
          type="button"
          onClick={handleDismissEducation}
          className="w-full py-3.5 min-h-11 rounded-xl bg-primary text-white font-semibold"
        >
          Got it
        </button>
      </BottomSheet>
    </div>
  );
}

function PracticeAddRow({
  practiceId,
  name,
  instanceCount,
  atCap,
  onAdd,
}: {
  practiceId: string;
  name: string;
  instanceCount: number;
  atCap: boolean;
  onAdd: () => void;
}) {
  const hidden = instanceCount >= 2;
  const opacity = instanceCount === 1 ? 'opacity-50' : '';
  const addAgain = instanceCount === 1;

  if (hidden) return null;

  return (
    <div className={`flex items-center gap-3 py-3 border-b border-hairline last:border-0 ${opacity}`}>
      <PracticeIllustration practiceId={practiceId} size={40} />
      <div className="flex-1 min-w-0">
        <p className="text-body truncate">{name}</p>
      </div>
      <button
        onClick={onAdd}
        disabled={atCap}
        className={`flex items-center justify-center text-primary disabled:opacity-30 min-h-11 ${
          addAgain
            ? 'px-3 text-meta'
            : 'w-11 h-11 rounded-[7px] border-2 border-primary font-bold text-lg'
        }`}
        aria-label={addAgain ? `Add ${name} again` : `Add ${name}`}
      >
        {addAgain ? 'Add again' : '+'}
      </button>
    </div>
  );
}
