// PLACEHOLDERS — final names and properties come from the analytics session.
// Every backtracking event name lives here so it can be renamed in one place.
export const EVENTS = {
  daySwitched: 'day_switched',
  practiceBacktracked: 'practice_backtracked',
  missedSheetShown: 'missed_day_sheet_shown',
  missedSheetAnswered: 'missed_day_sheet_answered',
  discoverySheetShown: 'feature_discovery_shown',
  discoverySheetDismissed: 'feature_discovery_dismissed',
  backtrackPushOpened: 'backtrack_push_opened',
} as const;

export type BacktrackEvent = (typeof EVENTS)[keyof typeof EVENTS];
