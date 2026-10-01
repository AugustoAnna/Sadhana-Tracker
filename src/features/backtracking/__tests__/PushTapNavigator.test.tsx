import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { todayKey } from '@/utils/dates';
import { PushTapNavigator } from '../PushTapNavigator';

// jsdom has no service worker; a plain EventTarget stands in for its messages.
const worker = new EventTarget();
beforeAll(() => {
  Object.defineProperty(navigator, 'serviceWorker', { value: worker, configurable: true });
});

beforeEach(() => {
  useAppStore.setState({ pushEntryOn: null });
});

function Location() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

function post(data: unknown) {
  act(() => {
    worker.dispatchEvent(new MessageEvent('message', { data }));
  });
}

function renderApp(at = '/reminders') {
  render(
    <MemoryRouter initialEntries={[at]}>
      <PushTapNavigator />
      <Location />
    </MemoryRouter>,
  );
}

const url = '/practice-home?day=yesterday&via=push&for=2026-09-29';

describe('PushTapNavigator', () => {
  it('opens the push link when the app was already open', () => {
    renderApp();

    post({ type: 'REMINDER_TAPPED', kind: 'backtrack', url });

    expect(screen.getByTestId('location').textContent).toBe(url);
  });

  it('leaves ordinary reminder taps alone', () => {
    renderApp();

    post({ type: 'REMINDER_TAPPED', kind: 'generic', url: '/' });

    expect(screen.getByTestId('location').textContent).toBe('/reminders');
  });

  it('only follows in-app paths', () => {
    renderApp();

    post({ type: 'REMINDER_TAPPED', kind: 'backtrack', url: 'https://example.com/x' });
    post({ type: 'REMINDER_TAPPED', kind: 'backtrack', url: '//example.com/x' });

    expect(screen.getByTestId('location').textContent).toBe('/reminders');
  });

  it('never pulls someone out of a practice in progress', () => {
    renderApp('/player');

    post({ type: 'REMINDER_TAPPED', kind: 'backtrack', url });

    expect(screen.getByTestId('location').textContent).toBe('/player');
  });

  it('does nothing once today already came in through the push', () => {
    useAppStore.setState({ pushEntryOn: todayKey() });
    renderApp();

    post({ type: 'REMINDER_TAPPED', kind: 'backtrack', url });

    expect(screen.getByTestId('location').textContent).toBe('/reminders');
  });
});
