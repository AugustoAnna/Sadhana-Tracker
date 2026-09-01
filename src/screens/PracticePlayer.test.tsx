import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PracticePlayer } from '@/screens/PracticePlayer';

const logPractice = vi.fn().mockResolvedValue(undefined);
const setPlayerSession = vi.fn();

const mockState = {
  playerSession: { practiceInstanceIds: ['inst-1'], includeInvocation: false },
  setPlayerSession,
  logPractice,
  instances: [{
    id: 'inst-1',
    practiceId: 'sadhguru-presence',
    instanceNumber: 1 as const,
    order: 0,
    addedAt: Date.now(),
  }],
};

vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector: (s: typeof mockState) => unknown) => selector(mockState),
  getDefaultLogMinutes: () => 10,
}));

vi.mock('@/services/audio', () => ({
  getPracticeAudio: () => Promise.resolve('blob:presence'),
}));

vi.mock('@/services/instrumentation', () => ({ track: vi.fn() }));

/** Duration and silent stretch of the Sadhguru's Presence chant. */
const DURATION = 614.8;

let currentTime = 0;
let paused = true;
let play: ReturnType<typeof vi.fn>;

function installMediaElement() {
  currentTime = 0;
  paused = true;
  play = vi.fn(() => { paused = false; return Promise.resolve(); });

  Object.defineProperty(HTMLMediaElement.prototype, 'duration', { configurable: true, get: () => DURATION });
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (v: number) => { currentTime = v; },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', { configurable: true, get: () => paused });
  Object.defineProperty(HTMLMediaElement.prototype, 'ended', { configurable: true, get: () => currentTime >= DURATION });
  HTMLMediaElement.prototype.play = play as unknown as HTMLMediaElement['play'];
  HTMLMediaElement.prototype.pause = vi.fn(() => { paused = true; });
  HTMLMediaElement.prototype.load = vi.fn(() => {
    queueMicrotask(() => document.querySelector('audio')?.dispatchEvent(new Event('loadedmetadata')));
  });
}

/** Advance both fake timers and playback position by `seconds`. */
async function advance(seconds: number, { playing = true } = {}) {
  for (let i = 0; i < seconds * 2; i++) {
    if (playing && !paused) currentTime = Math.min(DURATION, currentTime + 0.5);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  }
}

async function mountPlayer() {
  render(<MemoryRouter><PracticePlayer /></MemoryRouter>);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}

describe('PracticePlayer guided audio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    installMediaElement();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('nudges playback back when the OS suspends it mid-practice', async () => {
    await mountPlayer();
    await advance(10);
    expect(play).toHaveBeenCalledTimes(1);

    // The phone suspends the element part-way through the silent stretch.
    paused = true;
    await advance(6, { playing: false });

    expect(play.mock.calls.length).toBeGreaterThan(1);
    expect(paused).toBe(false);
  });

  it('still completes the session when playback cannot be revived', async () => {
    await mountPlayer();
    await advance(10);

    play.mockImplementation(() => Promise.reject(new Error('suspended')));
    paused = true;
    await advance(35, { playing: false });

    // Falls back to the wall clock rather than freezing on a dead countdown.
    expect(logPractice).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(DURATION * 1000); });
    expect(logPractice).toHaveBeenCalledWith('inst-1', 10, 'player');
  });

  it('finishes when the audio reaches the end', async () => {
    await mountPlayer();
    currentTime = DURATION;
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(logPractice).toHaveBeenCalledWith('inst-1', 10, 'player');
  });
});
