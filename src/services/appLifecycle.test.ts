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

  it('records the theme the app is showing', async () => {
    useThemeStore.setState({ theme: 'dark' });
    await reportAppOpen();
    expect(track).toHaveBeenCalledWith('app_open', expect.objectContaining({ theme: 'dark' }));

    useThemeStore.setState({ theme: 'light' });
    await reportAppOpen();
    expect(track).toHaveBeenLastCalledWith('app_open', expect.objectContaining({ theme: 'light' }));
  });
});
