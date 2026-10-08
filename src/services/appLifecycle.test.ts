import { describe, it, expect, vi, beforeEach } from 'vitest';
import { track } from './instrumentation';
import { reportAppOpen } from './appLifecycle';
import { useThemeStore } from './theme';
import { useAuthStore } from '@/stores/authStore';

vi.mock('./instrumentation', () => ({ track: vi.fn() }));
vi.mock('./sync', () => ({ updateParticipantFields: vi.fn() }));
vi.mock('./notifications', () => ({ getNotificationPermission: () => 'granted' }));

describe('reportAppOpen', () => {
  beforeEach(() => {
    // jsdom has no matchMedia; isStandalone() asks it about display-mode.
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.mocked(track).mockClear();
    useAuthStore.setState({ state: 'signed-in' });
  });

  it('records the theme on screen and the mode picked in Settings', async () => {
    useThemeStore.setState({ theme: 'dark', mode: 'auto' });
    await reportAppOpen();
    expect(track).toHaveBeenCalledWith('app_open', expect.objectContaining({ theme: 'dark', mode: 'auto' }));

    useThemeStore.setState({ theme: 'light', mode: 'light' });
    await reportAppOpen();
    expect(track).toHaveBeenLastCalledWith('app_open', expect.objectContaining({ theme: 'light', mode: 'light' }));
  });
});
