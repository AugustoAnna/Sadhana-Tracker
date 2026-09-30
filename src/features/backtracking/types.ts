/** 'yyyy-MM-dd', device-local. */
export type LocalDate = string;
export type DayKey = 'today' | 'yesterday';
/** How the user arrived on Yesterday for a write. */
export type BacktrackRoute = 'switcher' | 'sheet' | 'push';
