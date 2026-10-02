import { type ReactNode, type PointerEvent, useEffect, useRef, useState } from 'react';

export type SheetCloseReason = 'close' | 'swipe' | 'backdrop';

interface BottomSheetProps {
  open: boolean;
  /** How it was closed: the ✕, a swipe down, or a tap outside. */
  onClose: (reason: SheetCloseReason) => void;
  title?: string;
  children: ReactNode;
  hideCloseButton?: boolean;
  dismissOnBackdrop?: boolean;
  /** Drag down to close, with a grabber. For short sheets: their content can't scroll by touch. */
  swipeToDismiss?: boolean;
}

/** Movement before a press counts as a drag, so taps on buttons inside still land. */
const DRAG_SLOP_PX = 6;
const DISMISS_FRACTION = 0.25;
const DISMISS_VELOCITY_PX_PER_MS = 0.5;
/** A finger held still this long before lifting is not a flick, however fast it moved before. */
const FLICK_MAX_PAUSE_MS = 100;

interface Drag {
  pointerId: number;
  startY: number;
  lastY: number;
  lastT: number;
  velocity: number;
  active: boolean;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  hideCloseButton = false,
  dismissOnBackdrop = true,
  swipeToDismiss = false,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [offset, setOffset] = useState(0);
  const [springBack, setSpringBack] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    setOffset(0);
    dragRef.current = null;
  }, [open]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!swipeToDismiss || (panelRef.current?.scrollTop ?? 0) > 0) return;
    const now = performance.now();
    dragRef.current = { pointerId: e.pointerId, startY: e.clientY, lastY: e.clientY, lastT: now, velocity: 0, active: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dy = e.clientY - drag.startY;
    if (!drag.active) {
      if (dy <= -DRAG_SLOP_PX) dragRef.current = null; // an upward move is not a dismiss
      if (dy < DRAG_SLOP_PX) return;
      drag.active = true;
      // Capture, so the release lands on the panel rather than clicking the
      // button the drag started on.
      panelRef.current?.setPointerCapture(e.pointerId);
      setSpringBack(false);
    }
    const now = performance.now();
    if (now > drag.lastT) drag.velocity = (e.clientY - drag.lastY) / (now - drag.lastT);
    drag.lastY = e.clientY;
    drag.lastT = now;
    setOffset(Math.max(0, dy));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.active || e.pointerId !== drag.pointerId) return;
    const height = panelRef.current?.offsetHeight ?? 0;
    const dy = Math.max(0, e.clientY - drag.startY);
    const flicked = performance.now() - drag.lastT <= FLICK_MAX_PAUSE_MS
      && drag.velocity > DISMISS_VELOCITY_PX_PER_MS;
    if (dy > height * DISMISS_FRACTION || flicked) {
      onClose('swipe');
      return;
    }
    setSpringBack(true);
    setOffset(0);
  };

  const onPointerCancel = () => {
    const wasDragging = dragRef.current?.active;
    dragRef.current = null;
    if (wasDragging) {
      setSpringBack(true);
      setOffset(0);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {dismissOnBackdrop && (
        <div className="absolute inset-0 bg-black/50" onClick={() => onClose('backdrop')} />
      )}
      {!dismissOnBackdrop && <div className="absolute inset-0 bg-black/50" />}
      <div
        ref={panelRef}
        className="relative w-full bg-card rounded-t-[18px] px-4 pt-4 pb-8 safe-bottom max-h-[85vh] overflow-y-auto"
        style={swipeToDismiss ? {
          transform: offset ? `translateY(${offset}px)` : undefined,
          transition: springBack ? 'transform 150ms ease-out' : undefined,
          touchAction: 'none',
        } : undefined}
        onPointerDown={swipeToDismiss ? onPointerDown : undefined}
        onPointerMove={swipeToDismiss ? onPointerMove : undefined}
        onPointerUp={swipeToDismiss ? onPointerUp : undefined}
        onPointerCancel={swipeToDismiss ? onPointerCancel : undefined}
      >
        {swipeToDismiss && (
          <div className="mx-auto -mt-1 mb-3 w-9 h-1 rounded-[2px] bg-[#D9D9D9]" data-testid="sheet-grabber" aria-hidden />
        )}
        <div className={`flex items-center justify-between mb-4 ${hideCloseButton ? '' : 'pr-8'}`}>
          {title && <h2 className="font-serif text-headline flex-1 text-center">{title}</h2>}
          {!hideCloseButton && (
            <button onClick={() => onClose('close')} className="absolute right-4 top-4 w-11 h-11 flex items-center justify-center" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
