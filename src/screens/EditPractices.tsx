import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BackHeader, PracticeIllustration, ConfirmFooter,
} from '@/components';
import { COPY } from '@/copy/strings';
import { useAppStore } from '@/stores/appStore';
import {
  PRACTICES, COMMONLY_PRACTICED_IDS, MAX_PRACTICE_INSTANCES, getPractice,
} from '@/data/catalogue';
import { getResolvedKind } from '@/data/practiceAssets';

function OtherSectionHeader({
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
      className="flex items-center justify-between w-full py-2 text-title"
    >
      {title}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={`transition-transform duration-150 ease-in-out ${open ? 'rotate-180' : ''}`}
        aria-hidden
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

export function EditPractices() {
  const navigate = useNavigate();
  const location = useLocation();
  const firstSetup = (location.state as { firstSetup?: boolean })?.firstSetup ?? false;

  const instances = useAppStore((s) => s.instances);
  const addPracticeInstance = useAppStore((s) => s.addPracticeInstance);
  const removeAllInstancesForPractice = useAppStore((s) => s.removeAllInstancesForPractice);
  const setPracticeInstanceCount = useAppStore((s) => s.setPracticeInstanceCount);
  const profile = useAppStore((s) => s.profile);

  const inSetup = firstSetup || !profile?.onboardingComplete;
  const showSubtitle = profile?.onboardingComplete && !firstSetup;

  const [otherOpen, setOtherOpen] = useState(false);

  const atCap = instances.length >= MAX_PRACTICE_INSTANCES;

  const getInstanceCount = (practiceId: string) =>
    instances.filter((i) => i.practiceId === practiceId).length;

  const handleTogglePractice = async (practiceId: string) => {
    const count = getInstanceCount(practiceId);
    if (count > 0) {
      await removeAllInstancesForPractice(practiceId);
      return;
    }
    if (atCap) return;
    await addPracticeInstance(practiceId);
  };

  const handleChipSelect = async (practiceId: string, count: 1 | 2) => {
    if (getInstanceCount(practiceId) === 0) return;
    if (count === 2 && atCap && getInstanceCount(practiceId) === 1) return;
    await setPracticeInstanceCount(practiceId, count);
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
        <BackHeader title={COPY.setup.header.title} onBack={handleBack} />
        {showSubtitle && (
          <p className="px-4 text-label text-secondary mb-5">
            {COPY.setup.header.subtitle.fromTracker}
          </p>
        )}
        {!showSubtitle && <div className="mb-5" />}

        <div className="px-4 mb-5">
          <p className="section-header mb-2">{COPY.setup.section.common}</p>
          <div className="bg-card rounded-[14px] mt-1">
            {commonlyPracticed.map((p) => p && (
              <SetupPracticeRow
                key={p.id}
                practiceId={p.id}
                name={p.name}
                instanceCount={getInstanceCount(p.id)}
                atCap={atCap}
                isTimed={getResolvedKind(p.id) === 'timed'}
                onToggle={() => handleTogglePractice(p.id)}
                onSelectCount={(n) => handleChipSelect(p.id, n)}
              />
            ))}
          </div>
        </div>

        <div className="px-4 mb-5">
          <OtherSectionHeader
            title={COPY.setup.section.other}
            open={otherOpen}
            onToggle={() => setOtherOpen(!otherOpen)}
          />
          {otherOpen && (
            <div className="bg-card rounded-[14px] mt-1">
              {otherPractices.map((p) => (
                <SetupPracticeRow
                  key={p.id}
                  practiceId={p.id}
                  name={p.name}
                  instanceCount={getInstanceCount(p.id)}
                  atCap={atCap}
                  isTimed={getResolvedKind(p.id) === 'timed'}
                  onToggle={() => handleTogglePractice(p.id)}
                  onSelectCount={(n) => handleChipSelect(p.id, n)}
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
    </div>
  );
}

function SetupPracticeRow({
  practiceId,
  name,
  instanceCount,
  atCap,
  isTimed,
  onToggle,
  onSelectCount,
}: {
  practiceId: string;
  name: string;
  instanceCount: number;
  atCap: boolean;
  isTimed: boolean;
  onToggle: () => void;
  onSelectCount: (count: 1 | 2) => void;
}) {
  const added = instanceCount > 0;
  const selectedCount: 1 | 2 = instanceCount >= 2 ? 2 : 1;

  return (
    <div className="flex items-center gap-3 py-3 px-3 border-b border-hairline last:border-0">
      <PracticeIllustration practiceId={practiceId} size={40} />
      <div className="flex-1 min-w-0">
        <p className="text-body truncate">{name}</p>
        {added && !isTimed && (
          <div className="flex gap-2 mt-2">
            <ChipButton
              label={COPY.setup.chip.once}
              selected={selectedCount === 1}
              onClick={() => onSelectCount(1)}
            />
            <ChipButton
              label={COPY.setup.chip.twice}
              selected={selectedCount === 2}
              onClick={() => onSelectCount(2)}
            />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={!added && atCap}
        className={`px-3 py-1.5 rounded-[7px] text-meta font-semibold min-h-11 flex-shrink-0 disabled:opacity-30 ${
          added
            ? 'border-2 border-primary text-primary'
            : 'bg-primary text-white'
        }`}
      >
        {added ? COPY.setup.action.remove : COPY.setup.action.add}
      </button>
    </div>
  );
}

function ChipButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-[7px] text-meta font-semibold min-h-8 ${
        selected
          ? 'bg-primary text-white'
          : 'border border-hairline text-secondary'
      }`}
    >
      {label}
    </button>
  );
}
