import { describe, it, expect, vi, beforeEach } from 'vitest';
import { track } from './instrumentation';
import { initAppLifecycle, reportAppOpen } from './appLifecycle';
import { drainSyncQueue } from './sync';
import { useThemeStore } from './theme';
import { useAuthStore } from '@/stores/authStore';

vi.mock('./instrumentation', () => ({ track: vi.fn() }));
vi.mock('./sync', () => ({ updateParticipantFields: vi.fn(), drainSyncQueue: vi.fn() }));
vi.mock('./storagePersistence', () => ({ requestPersistentStorage: async () => true }));
vi.mock('./notifications', () => ({ getNotificationPermission: () => 'granted' }));

describe('reportAppOpen', () => {
  beforeEach(() => {
    // jsdom has no matchMedia; isStandalone() asks it about display-mode.
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.mocked(track).mockClear();
    useAuthStore.setState({ state: 'signed-in' });
  });

  it('records the theme the app is showing', async () => {
    useThemeStore.setState({ theme: 'dark' });
    await reportAppOpen();
    expect(track).toHaveBeenCalledWith('app_open', expect.objectContaining({ theme: 'dark' }));

    useThemeStore.setState({ theme: 'light' });
    await reportAppOpen();
    expect(track).toHaveBeenLastCalledWith('app_open', expect.objectContaining({ theme: 'light' }));
  });

  it('records whether local storage is kept when space runs low', async () => {
    await reportAppOpen();
    expect(track).toHaveBeenCalledWith('app_open', expect.objectContaining({ storage_persisted: true }));
  });
});

describe('back in front', () => {
  it('sends anything waiting to upload', async () => {
    useAuthStore.setState({ state: 'signed-out' });
    await initAppLifecycle();
    vi.mocked(drainSyncQueue).mockClear();

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(drainSyncQueue).not.toHaveBeenCalled();

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(drainSyncQueue).toHaveBeenCalledTimes(1);
  });
});
