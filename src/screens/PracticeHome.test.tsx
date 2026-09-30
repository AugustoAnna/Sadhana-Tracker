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
  currentDay: '2026-08-23',
  profile: {},
  logPractice: vi.fn(),
  setPlayerSession: vi.fn(),
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

  it('does not show the name banner', () => {
    const { queryByText } = render(
      <MemoryRouter>
        <PracticeHome />
      </MemoryRouter>,
    );
    expect(queryByText(/Namaskaram/)).toBeNull();
  });

  it('does not link to practice-so-far detail screen', () => {
    const { container } = render(
      <MemoryRouter>
        <PracticeHome />
      </MemoryRouter>,
    );
    expect(container.innerHTML).not.toContain('practice-so-far');
  });

  it('shows the app name and the reminders bell in a compact header, not a title bar', () => {
    const { container } = render(
      <MemoryRouter>
        <PracticeHome />
      </MemoryRouter>,
    );
    const header = container.querySelector('header');
    expect(header?.textContent).toContain('Sadhana Tracker');
    expect(container.textContent).not.toMatch(/Practices of|My Practices/);
    expect(header?.querySelector('button[aria-label="Reminders"]')).not.toBeNull();
  });
});
