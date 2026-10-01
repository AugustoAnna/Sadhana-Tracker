import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { track } from '@/services/instrumentation';
import { todayKey, yesterdayOf } from '@/utils/dates';
import type { BacktrackRoute, DayKey, LocalDate } from '@/types';
import { EVENTS } from './analyticsNames';
import type { MissedVariant } from './missedDayRule';
import { MissedDaySheet, type MissedDayAnswer } from './MissedDaySheet';
import { DiscoverySheet, type DiscoveryDismissal } from './DiscoverySheet';
import { nextPrompt } from './promptRule';

/** Yesterday, and the day it was chosen on. */
export interface YesterdayPick {
  madeOn: LocalDate;
  route: BacktrackRoute;
}

/**
 * The backtracking prompts on practice home: the one-time tip, the missed-day
 * question, and landing from the backtracking push. `sheetOpen` is another
 * sheet on the screen, which prompts wait for rather than stacking on it.
 * `onPick` moves the screen to Yesterday, or back to Today (null).
 */
export function BacktrackPrompts({
  sheetOpen,
  onPick,
}: {
  sheetOpen: boolean;
  onPick: (pick: YesterdayPick | null) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const today = useAppStore((s) => s.currentDay);
  const remoteRestoreSettled = useAppStore((s) => s.remoteRestoreSettled);
  const name = useAppStore((s) => s.profile?.name?.trim() ?? '');
  const [missedVariant, setMissedVariant] = useState<MissedVariant | null>(null);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);

  // Both effects read the store directly rather than this render's copies:
  // the markers one sets (or a StrictMode first run sets) are already there.

  // Arriving from the push (?day=yesterday&via=push&for=…): open on Yesterday
  // if that day is still yesterday and still empty — otherwise Today (a tap
  // the next day, or a log the server hadn't seen) — then drop the query.
  // Declared before the prompts check so it runs first.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('via') !== 'push') return;
    const store = useAppStore.getState();
    // An app resumed from overnight can still be on yesterday's date until
    // refreshDay catches up, and the tap may arrive first: decide against the
    // clock, and catch the store up.
    const now = todayKey();
    if (now !== store.currentDay) void store.refreshDay();
    store.markPushEntryOn(now);
    const forDay = params.get('for');
    const landed: DayKey = params.get('day') === 'yesterday'
      && store.instances.length > 0
      && forDay === yesterdayOf(now)
      && !store.logs.some((l) => l.localDate === forDay)
      ? 'yesterday' : 'today';
    onPick(landed === 'yesterday' ? { madeOn: now, route: 'push' } : null);
    // No prompts over what the push already asked.
    setMissedVariant(null);
    setDiscoveryOpen(false);
    track(EVENTS.backtrackPushOpened, { landed });
    navigate(location.pathname, { replace: true });
  }, [location.search]);

  // Checked when the screen opens and when the day changes — not on every
  // log — once the launch-time server pull is in (another device may have
  // logged yesterday) and no other sheet is open. Each prompt saves its
  // marker at once so a reload doesn't repeat it.
  const waiting = !remoteRestoreSettled || sheetOpen || discoveryOpen;
  useEffect(() => {
    if (waiting) return;
    const store = useAppStore.getState();
    const prompt = nextPrompt(store, today);
    if (prompt?.kind === 'discovery') {
      setDiscoveryOpen(true);
      store.markDiscoveryShownOn(today);
      store.setFeatureDiscoveryStep(1).catch((err) => {
        console.error('Failed to save the discovery step:', err);
      });
      track(EVENTS.discoverySheetShown, { feature: 'backtracking' });
    } else if (prompt?.kind === 'missed') {
      setMissedVariant(prompt.variant);
      store.markMissedSheetShown(prompt.runKey).catch((err) => {
        console.error('Failed to save the missed-day run key:', err);
      });
      track(EVENTS.missedSheetShown, { variant: prompt.variant, gap_days: prompt.gapDays });
    }
  }, [today, waiting]);

  const answerMissedDay = (answer: MissedDayAnswer) => {
    if (missedVariant) track(EVENTS.missedSheetAnswered, { variant: missedVariant, answer });
    setMissedVariant(null);
    if (answer === 'log') onPick({ madeOn: today, route: 'sheet' });
  };

  const dismissDiscovery = (via: DiscoveryDismissal) => {
    track(EVENTS.discoverySheetDismissed, { feature: 'backtracking', via });
    setDiscoveryOpen(false);
  };

  return (
    <>
      <MissedDaySheet
        open={missedVariant !== null}
        variant={missedVariant ?? 1}
        name={name}
        onAnswer={answerMissedDay}
      />
      <DiscoverySheet open={discoveryOpen} onDismiss={dismissDiscovery} />
    </>
  );
}
