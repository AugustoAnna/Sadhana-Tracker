import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PracticeHome } from '@/screens/PracticeHome';

const mockState = {
  instances: [{
    id: 'inst-1',
    practiceId: 'isha-kriya',
    instanceNumber: 1 as const,
    order: 0,
    addedAt: Date.now(),
  }],
  logs: [],
  profile: { firstRecordReassuranceShown: true },
  serverName: null as string | null,
  bannerTargets: null as Set<string> | null,
  logPractice: vi.fn(),
  setPlayerSession: vi.fn(),
  markFirstRecordReassuranceShown: vi.fn(),
};

vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector: (s: typeof mockState) => unknown) => selector(mockState),
  getDefaultLogMinutes: () => 14,
}));

vi.mock('@/hooks', () => ({
  useHaptic: () => vi.fn(),
}));

describe('PracticeHome entry points (study build)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const flag of ['sessions', 'journey'] as const) {
    it(`has no ${flag} entry point in rendered tree`, () => {
      const { container } = render(
        <MemoryRouter>
          <PracticeHome />
        </MemoryRouter>,
      );
      const html = container.innerHTML;
      expect(html).not.toContain('/session/');
      expect(html).not.toContain('/journey');
      expect(html).not.toContain('Start session');
      expect(html).not.toContain('Level up');
    });
  }

  it('does not show the name banner by default', () => {
    const { queryByText } = render(
      <MemoryRouter>
        <PracticeHome />
      </MemoryRouter>,
    );
    expect(queryByText(/Namaskaram/)).toBeNull();
  });

  it('shows the name banner when server name is Anonymous', () => {
    mockState.serverName = 'Anonymous';
    mockState.bannerTargets = new Set(['Anonymous']);
    const { getByText } = render(
      <MemoryRouter>
        <PracticeHome />
      </MemoryRouter>,
    );
    expect(getByText(/Namaskaram 'Anonymous'/)).toBeDefined();
    mockState.serverName = null;
    mockState.bannerTargets = null;
  });

  it('does not show the name banner when server name is not in targets', () => {
    mockState.serverName = 'Priya';
    mockState.bannerTargets = new Set(['Anonymous']);
    const { queryByText } = render(
      <MemoryRouter>
        <PracticeHome />
      </MemoryRouter>,
    );
    expect(queryByText(/Namaskaram/)).toBeNull();
    mockState.serverName = null;
    mockState.bannerTargets = null;
  });

  it('does not link to practice-so-far detail screen', () => {
    const { container } = render(
      <MemoryRouter>
        <PracticeHome />
      </MemoryRouter>,
    );
    expect(container.innerHTML).not.toContain('practice-so-far');
  });
});
