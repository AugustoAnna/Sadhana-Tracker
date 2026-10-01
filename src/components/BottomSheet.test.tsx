import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomSheet } from './BottomSheet';

// jsdom has no PointerEvent (so clientY/pointerId would be dropped) and no
// pointer capture; stand in for both.
beforeAll(() => {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  Element.prototype.setPointerCapture = () => {};
});

let now = 0;
beforeEach(() => {
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  // A 400px sheet: a quarter is 100px.
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
});
afterEach(() => vi.restoreAllMocks());

function panel() {
  return screen.getByText('Body').parentElement as HTMLElement;
}

/** Press, move in steps of `stepPx` every `stepMs`, release. */
function drag(el: HTMLElement, totalPx: number, stepPx: number, stepMs: number) {
  fireEvent.pointerDown(el, { pointerId: 1, clientY: 100 });
  let y = 100;
  while (y - 100 < totalPx) {
    y = Math.min(100 + totalPx, y + stepPx);
    now += stepMs;
    fireEvent.pointerMove(el, { pointerId: 1, clientY: y });
  }
  now += stepMs;
  fireEvent.pointerUp(el, { pointerId: 1, clientY: y });
}

function sheet(onClose: () => void, swipeToDismiss = true) {
  return render(
    <BottomSheet open onClose={onClose} swipeToDismiss={swipeToDismiss}>
      <p>Body</p>
    </BottomSheet>,
  );
}

describe('BottomSheet swipe to dismiss', () => {
  it('closes after a slow drag past a quarter of the sheet', () => {
    const onClose = vi.fn();
    sheet(onClose);

    drag(panel(), 120, 10, 100); // 0.1 px/ms

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('springs back after a short slow drag', () => {
    const onClose = vi.fn();
    sheet(onClose);

    drag(panel(), 60, 10, 100);

    expect(onClose).not.toHaveBeenCalled();
    expect(panel().style.transform).toBe('');
  });

  it('closes on a short fast flick', () => {
    const onClose = vi.fn();
    sheet(onClose);

    drag(panel(), 40, 20, 10); // 2 px/ms

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('springs back when a quick short drag pauses before release', () => {
    const onClose = vi.fn();
    sheet(onClose);

    fireEvent.pointerDown(panel(), { pointerId: 1, clientY: 100 });
    now += 10;
    fireEvent.pointerMove(panel(), { pointerId: 1, clientY: 120 });
    now += 10;
    fireEvent.pointerMove(panel(), { pointerId: 1, clientY: 140 }); // 2 px/ms
    now += 800; // held still, then lifted
    fireEvent.pointerUp(panel(), { pointerId: 1, clientY: 140 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('follows the finger while dragging', () => {
    sheet(vi.fn());

    fireEvent.pointerDown(panel(), { pointerId: 1, clientY: 100 });
    now += 50;
    fireEvent.pointerMove(panel(), { pointerId: 1, clientY: 150 });

    expect(panel().style.transform).toBe('translateY(50px)');
  });

  it('treats a small wobble as a tap, not a drag', () => {
    const onClose = vi.fn();
    const onTap = vi.fn();
    render(
      <BottomSheet open onClose={onClose} swipeToDismiss>
        <button onClick={onTap}>Body</button>
      </BottomSheet>,
    );
    const button = screen.getByText('Body');

    fireEvent.pointerDown(button, { pointerId: 1, clientY: 100 });
    now += 50;
    fireEvent.pointerMove(button, { pointerId: 1, clientY: 104 });
    fireEvent.pointerUp(button, { pointerId: 1, clientY: 104 });
    fireEvent.click(button);

    expect(onClose).not.toHaveBeenCalled();
    expect(onTap).toHaveBeenCalled();
  });

  it('ignores upward drags', () => {
    const onClose = vi.fn();
    sheet(onClose);

    fireEvent.pointerDown(panel(), { pointerId: 1, clientY: 300 });
    now += 10;
    fireEvent.pointerMove(panel(), { pointerId: 1, clientY: 200 });
    fireEvent.pointerUp(panel(), { pointerId: 1, clientY: 200 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('springs back when the browser cancels the drag', () => {
    const onClose = vi.fn();
    sheet(onClose);

    fireEvent.pointerDown(panel(), { pointerId: 1, clientY: 100 });
    now += 100;
    fireEvent.pointerMove(panel(), { pointerId: 1, clientY: 160 });
    fireEvent.pointerCancel(panel(), { pointerId: 1 });

    expect(onClose).not.toHaveBeenCalled();
    expect(panel().style.transform).toBe('');
  });

  it('reports how it was closed', () => {
    const onClose = vi.fn();
    const { container } = sheet(onClose);

    fireEvent.click(screen.getByLabelText('Close'));
    fireEvent.click(container.querySelector('.bg-black\\/50') as Element);
    drag(panel(), 200, 20, 100);

    expect(onClose.mock.calls).toEqual([['close'], ['backdrop'], ['swipe']]);
  });

  it('shows a grabber only when enabled', () => {
    const { unmount } = sheet(vi.fn());
    expect(screen.queryByTestId('sheet-grabber')).not.toBeNull();
    unmount();

    sheet(vi.fn(), false);
    expect(screen.queryByTestId('sheet-grabber')).toBeNull();
  });

  it('leaves sheets without it untouched by drags', () => {
    const onClose = vi.fn();
    sheet(onClose, false);

    drag(panel(), 300, 50, 10);

    expect(onClose).not.toHaveBeenCalled();
    expect(panel().getAttribute('style')).toBeNull();
  });
});
