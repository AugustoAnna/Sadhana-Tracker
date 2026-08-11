import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BackHeader, BottomSheet, PracticeIllustration, ConfirmFooter, PracticeName, PracticeCard,
} from '@/components';
import { useAppStore } from '@/stores/appStore';
import {
  PRACTICES, COMMONLY_PRACTICED_IDS, MAX_PRACTICE_INSTANCES, getPractice,
} from '@/data/catalogue';
import { getResolvedKind } from '@/data/practiceAssets';
import { sortAlphabetically } from '@/utils/sortInstances';
import type { PracticeInstance } from '@/types';

function SectionHeader({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 w-full py-2 text-title"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={`transition-transform ${open ? 'rotate-180' : ''}`}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
      {title}
    </button>
  );
}

const SHOONYA_EXAMPLE_INSTANCES: PracticeInstance[] = [
  { id: 'example-1', practiceId: 'shoonya', instanceNumber: 1, order: 0, addedAt: 0 },
  { id: 'example-2', practiceId: 'shoonya', instanceNumber: 2, order: 1, addedAt: 0 },
];

export function EditPractices() {
  const navigate = useNavigate();
  const location = useLocation();
  const firstSetup = (location.state as { firstSetup?: boolean })?.firstSetup ?? false;

  const instances = useAppStore((s) => s.instances);
  const addPracticeInstance = useAppStore((s) => s.addPracticeInstance);
  const removePracticeInstance = useAppStore((s) => s.removePracticeInstance);
  const profile = useAppStore((s) => s.profile);
  const markEducationShown = useAppStore((s) => s.markInstanceEducationShown);

  const inSetup = firstSetup || !profile?.onboardingComplete;

  const [addedOpen, setAddedOpen] = useState(false);
  const [commonOpen, setCommonOpen] = useState(true);
  const [otherOpen, setOtherOpen] = useState(false);
  const [educationOpen, setEducationOpen] = useState(false);

  const atCap = instances.length >= MAX_PRACTICE_INSTANCES;

  const getInstanceCount = (practiceId: string) =>
    instances.filter((i) => i.practiceId === practiceId).length;

  const handleAdd = async (practiceId: string) => {
    if (atCap) return;
    const count = getInstanceCount(practiceId);
    if (count >= 2) return;

    const kind = getResolvedKind(practiceId);
    const allowsSecondInstance = kind !== 'timed';
    const shouldShowEducation = allowsSecondInstance && !profile?.instanceEducationShown;

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
    if (inSetup) {
      navigate('/reminders', { state: { firstSetup: true } });
    } else {
      navigate('/practice-home');
    }
  };

  const handleBack = () => {
    if (inSetup) {
      navigate('/welcome/name');
    } else {
      navigate('/practice-home');
    }
  };

  const getName = (id: string) => getPractice(id)?.name ?? id;
  const sortedAdded = sortAlphabetically(instances, getName);

  const commonlyPracticed = [...COMMONLY_PRACTICED_IDS]
    .map((id) => getPractice(id))
    .filter(Boolean)
    .sort((a, b) => a!.name.localeCompare(b!.name));

  const otherPractices = PRACTICES
    .filter((p) => !COMMONLY_PRACTICED_IDS.includes(p.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="h-full flex flex-col bg-page">
      <div className="flex-1 overflow-y-auto pb-28">
        <BackHeader title="My practices" onBack={handleBack} />
        <p className="px-4 text-label text-secondary mb-5">
          Select the practices you have learnt and are currently practicing.
        </p>

        {instances.length > 0 && (
          <div className="px-4 mb-5">
            <SectionHeader title="Added" open={addedOpen} onToggle={() => setAddedOpen(!addedOpen)} />
            {addedOpen && (
              <div className="bg-card rounded-[14px] mt-1">
                {sortedAdded.map((inst) => {
                  const p = getPractice(inst.practiceId);
                  if (!p) return null;
                  return (
                    <div key={inst.id} className="flex items-center gap-3 py-3 px-3 border-b border-hairline last:border-0">
                      <PracticeIllustration practiceId={p.id} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="text-body truncate">
                          <PracticeName name={p.name} instance={inst} instances={instances} />
                        </p>
                      </div>
                      <button
                        type="button"
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
          <SectionHeader
            title="Commonly practiced"
            open={commonOpen}
            onToggle={() => setCommonOpen(!commonOpen)}
          />
          {commonOpen && (
            <div className="bg-card rounded-[14px] mt-1">
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
          )}
        </div>

        <div className="px-4 mb-5">
          <SectionHeader
            title="All other practices"
            open={otherOpen}
            onToggle={() => setOtherOpen(!otherOpen)}
          />
          {otherOpen && (
            <div className="bg-card rounded-[14px] mt-1">
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
            You can add up to 21 practices.
          </p>
        )}
      </div>

      <ConfirmFooter
        count={instances.length}
        disabled={instances.length === 0}
        onClick={handleDone}
      />

      <BottomSheet
        open={educationOpen}
        onClose={handleDismissEducation}
        title="Practicing twice a day?"
      >
        <p className="text-label text-secondary mb-4">
          Add a practice again so it appears in your list twice and you can mark each one.
        </p>

        <p className="text-meta text-secondary mb-2">Example</p>
        <div className="bg-card rounded-[14px] mb-6 divide-y divide-hairline">
          {SHOONYA_EXAMPLE_INSTANCES.map((inst) => (
            <PracticeCard
              key={inst.id}
              instance={inst}
              allInstances={SHOONYA_EXAMPLE_INSTANCES}
              completed={false}
              completedTwice={false}
            />
          ))}
        </div>

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
  const kind = getResolvedKind(practiceId);
  const allowsSecond = kind !== 'timed';
  const hidden = instanceCount >= (allowsSecond ? 2 : 1);
  const addAgain = instanceCount === 1;

  if (hidden) return null;

  return (
    <div className="flex items-center gap-3 py-3 px-3 border-b border-hairline last:border-0">
      <PracticeIllustration practiceId={practiceId} size={40} />
      <div className="flex-1 min-w-0">
        <p className="text-body truncate">{name}</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={atCap}
        className={`px-3 py-1.5 rounded-[7px] text-meta font-semibold min-h-11 disabled:opacity-30 ${
          addAgain
            ? 'border-2 border-primary text-primary'
            : 'bg-primary text-white'
        }`}
        aria-label={addAgain ? `Add ${name} again` : `Add ${name}`}
      >
        {addAgain ? 'Add again' : 'Add'}
      </button>
    </div>
  );
}
