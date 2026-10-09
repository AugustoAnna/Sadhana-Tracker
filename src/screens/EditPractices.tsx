import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BackHeader, PracticeIllustration, ConfirmFooter, DayStatCards,
} from '@/components';
import { COPY } from '@/copy/strings';
import { useAppStore } from '@/stores/appStore';
import { PRACTICES, COMMONLY_PRACTICED_IDS } from '@/data/catalogue';
import { getSortOrder } from '@/data/idealSequence';
import { getResolvedKind } from '@/data/practiceAssets';
import { DayBar } from '@/features/backtracking/DaySwitcher';
import { getLogsForDay, getMinutesForDay, getPracticesCompletedOn } from '@/utils/dates';
import type { PracticeInstance } from '@/types';

/** How many instances (1 or 2) each practice has. */
function countsByPractice(instances: PracticeInstance[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const i of instances) counts.set(i.practiceId, (counts.get(i.practiceId) ?? 0) + 1);
  return counts;
}

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
  const navState = location.state as { firstSetup?: boolean; listTop?: number } | null;
  const firstSetup = navState?.firstSetup ?? false;

  const instances = useAppStore((s) => s.instances);
  const addPracticeInstance = useAppStore((s) => s.addPracticeInstance);
  const removeAllInstancesForPractice = useAppStore((s) => s.removeAllInstancesForPractice);
  const setPracticeInstanceCount = useAppStore((s) => s.setPracticeInstanceCount);
  const profile = useAppStore((s) => s.profile);
  const logs = useAppStore((s) => s.logs);
  const today = useAppStore((s) => s.currentDay);
  const todayLogs = useMemo(() => getLogsForDay(logs, today), [logs, today]);

  const inSetup = firstSetup || !profile?.onboardingComplete;
  const showSubtitle = profile?.onboardingComplete && !firstSetup;

  const [otherOpen, setOtherOpen] = useState(false);

  // What was saved when the screen opened. The lists are built from this, so a
  // row stays where it is while it is added or removed (each tap still saves at
  // once); the next visit shows it in its new list.
  const [openedCounts] = useState(() => countsByPractice(instances));

  // Opened from the tracker: push My Practices down to where the tracker's
  // list was on screen, so the list stays in place instead of jumping up.
  // Measured before the first paint, so it never shows in the wrong place.
  const myListRef = useRef<HTMLDivElement>(null);
  const [myListOffset, setMyListOffset] = useState(0);
  useLayoutEffect(() => {
    const target = navState?.listTop;
    if (target == null || !myListRef.current) return;
    setMyListOffset(Math.max(0, Math.round(target - myListRef.current.getBoundingClientRect().top)));
    // Only on opening: later edits must not move the list.
  }, []);

  // Practices added, removed or switched between 1X and 2X since the screen opened.
  const currentCounts = countsByPractice(instances);
  const changedCount = [...new Set([...openedCounts.keys(), ...currentCounts.keys()])]
    .filter((id) => openedCounts.get(id) !== currentCounts.get(id)).length;

  const getInstanceCount = (practiceId: string) =>
    instances.filter((i) => i.practiceId === practiceId).length;

  const handleTogglePractice = async (practiceId: string) => {
    const count = getInstanceCount(practiceId);
    if (count > 0) {
      await removeAllInstancesForPractice(practiceId);
      return;
    }
    await addPracticeInstance(practiceId);
  };

  const handleChipSelect = async (practiceId: string, count: 1 | 2) => {
    if (getInstanceCount(practiceId) === 0) return;
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

  // Each practice is in exactly one list: My Practices (in tracker order), or
  // else Commonly Practiced or Other Practices (alphabetical).
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const myPractices = PRACTICES
    .filter((p) => openedCounts.has(p.id))
    .sort((a, b) => getSortOrder(a.id) - getSortOrder(b.id) || byName(a, b));
  const commonlyPracticed = PRACTICES
    .filter((p) => !openedCounts.has(p.id) && COMMONLY_PRACTICED_IDS.includes(p.id))
    .sort(byName);
  const otherPractices = PRACTICES
    .filter((p) => !openedCounts.has(p.id) && !COMMONLY_PRACTICED_IDS.includes(p.id))
    .sort(byName);

  const renderRow = (p: { id: string; name: string }) => (
    <SetupPracticeRow
      key={p.id}
      practiceId={p.id}
      name={p.name}
      instanceCount={getInstanceCount(p.id)}
      isTimed={getResolvedKind(p.id) === 'timed'}
      onToggle={() => handleTogglePractice(p.id)}
      onSelectCount={(n) => handleChipSelect(p.id, n)}
    />
  );

  return (
    <div className="h-full flex flex-col bg-page">
      <div className="flex-1 overflow-y-auto pb-28">
        <BackHeader title={COPY.setup.header.title} onBack={handleBack} hideBack={inSetup} compact centered />
        {showSubtitle && (
          <p className="px-4 text-label text-secondary mb-5">
            {COPY.setup.header.subtitle.fromTracker}
          </p>
        )}
        {!showSubtitle && <div className="mb-5" />}

        {!inSetup && (
          // The tracker's top, read-only: always today, and the bar does nothing.
          // It fills the space above My Practices so the list stays near where
          // it was on the tracker.
          <div className="px-4 mb-5">
            <div className="mb-3">
              <DayBar />
            </div>
            <DayStatCards
              completed={getPracticesCompletedOn(todayLogs, today)}
              minutes={getMinutesForDay(todayLogs, today)}
            />
          </div>
        )}

        {myPractices.length > 0 && (
          // Padding, not margin: a margin here would merge with the subtitle's.
          <div className="px-4 mb-5" style={{ paddingTop: myListOffset }}>
            {/* Laid out like the tracker's "My practices" heading row. */}
            <div className="flex items-center h-11 mb-2">
              <p className="section-header">{COPY.setup.section.mine}</p>
            </div>
            <div ref={myListRef} className="bg-card rounded-[14px]">
              {myPractices.map(renderRow)}
            </div>
          </div>
        )}

        {commonlyPracticed.length > 0 && (
          <div className="px-4 mb-5">
            <p className="section-header mb-2">{COPY.setup.section.common}</p>
            <div className="bg-card rounded-[14px] mt-1">
              {commonlyPracticed.map(renderRow)}
            </div>
          </div>
        )}

        {otherPractices.length > 0 && (
          <div className="px-4 mb-5">
            <OtherSectionHeader
              title={COPY.setup.section.other}
              open={otherOpen}
              onToggle={() => setOtherOpen(!otherOpen)}
            />
            {otherOpen && (
              <div className="bg-card rounded-[14px] mt-1">
                {otherPractices.map(renderRow)}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmFooter
        count={changedCount}
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
  isTimed,
  onToggle,
  onSelectCount,
}: {
  practiceId: string;
  name: string;
  instanceCount: number;
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
        {/* Name and chips together are no taller than the Add/Remove button,
            so a row is the same height with or without chips. */}
        {added && !isTimed && (
          <div className="flex gap-2 mt-px">
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
        className={`px-3 py-1.5 rounded-[7px] text-meta font-semibold min-h-11 flex-shrink-0 ${
          added
            ? 'border-2 border-primary text-primary-text'
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
      className={`relative inline-flex items-center justify-center h-[22px] min-w-10 px-2.5 rounded-[6px] text-[12px] font-semibold ${
        selected
          ? 'bg-primary text-white'
          : 'border border-hairline text-secondary'
      }`}
    >
      {label}
      {/* A 44x44 tap area around the small chip. */}
      <span aria-hidden className="absolute -inset-x-0.5 -inset-y-[11px]" />
    </button>
  );
}
