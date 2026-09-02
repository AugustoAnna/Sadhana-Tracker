import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Listener = (state: { playerSession: unknown }) => void;

const store = {
  state: { playerSession: null as unknown },
  listeners: new Set<Listener>(),
  getState() { return store.state; },
  subscribe(listener: Listener) {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  },
  set(playerSession: unknown) {
    store.state = { playerSession };
    for (const l of [...store.listeners]) l(store.state);
  },
};

vi.mock('@/stores/appStore', () => ({
  useAppStore: {
    getState: () => store.getState(),
    subscribe: (listener: Listener) => store.subscribe(listener),
  },
}));

import { initServiceWorkerUpdates, reloadWhenPracticeEnds } from './swUpdate';

const reload = vi.fn();
let controllerChange: (() => void) | null = null;

function installServiceWorker({ controller }: { controller: boolean }) {
  controllerChange = null;
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller: controller ? {} : null,
      addEventListener: (event: string, handler: () => void) => {
        if (event === 'controllerchange') controllerChange = handler;
      },
    },
  });
}

describe('swUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reload.mockClear();
    store.state = { playerSession: null };
    store.listeners.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload },
    });
    installServiceWorker({ controller: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reloads straight away when no practice is running', () => {
    reloadWhenPracticeEnds();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('holds the reload until the practice ends', () => {
    store.state = { playerSession: { practiceInstanceIds: ['inst-1'] } };

    reloadWhenPracticeEnds();
    expect(reload).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);
    expect(reload).not.toHaveBeenCalled();

    store.set(null);
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads only once even if the session changes again', () => {
    store.state = { playerSession: { practiceInstanceIds: ['inst-1'] } };
    reloadWhenPracticeEnds();

    store.set(null);
    store.set({ practiceInstanceIds: ['inst-2'] });
    store.set(null);
    vi.advanceTimersByTime(5000);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads when a new worker takes over an already controlled page', () => {
    initServiceWorkerUpdates();
    controllerChange?.();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('ignores the first activation on a first-ever install', () => {
    installServiceWorker({ controller: false });
    initServiceWorkerUpdates();

    controllerChange?.();
    expect(reload).not.toHaveBeenCalled();

    controllerChange?.();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not interrupt a practice when the worker takes over mid-session', () => {
    store.state = { playerSession: { practiceInstanceIds: ['inst-1'] } };
    initServiceWorkerUpdates();

    controllerChange?.();
    vi.advanceTimersByTime(60_000);
    expect(reload).not.toHaveBeenCalled();

    store.set(null);
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
