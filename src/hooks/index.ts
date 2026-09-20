import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';

export function useInViewport<T extends HTMLElement>(onEnter?: () => void) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const pendingRef = useRef(false);

  const flush = useCallback(() => {
    if (onEnter && pendingRef.current) {
      pendingRef.current = false;
      onEnter();
    }
  }, [onEnter]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) {
          if (onEnter) {
            const pending = useAppStore.getState().pendingJourneyMinutes;
            if (pending > 0) {
              flush();
            } else {
              pendingRef.current = true;
            }
          }
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onEnter, flush]);

  useEffect(() => {
    const pending = useAppStore.getState().pendingJourneyMinutes;
    if (pending > 0 && inView) {
      flush();
    }
  }, [inView, flush]);

  useEffect(() => {
    const unsub = useAppStore.subscribe((state, prev) => {
      if (state.pendingJourneyMinutes > 0 && state.pendingJourneyMinutes !== prev.pendingJourneyMinutes && inView) {
        flush();
      } else if (state.pendingJourneyMinutes > 0) {
        pendingRef.current = true;
      }
    });
    return unsub;
  }, [inView, flush]);

  return { ref, inView };
}

export function useJourneyAnimation() {
  const pendingJourneyMinutes = useAppStore((s) => s.pendingJourneyMinutes);
  const clearPendingJourney = useAppStore((s) => s.clearPendingJourney);
  const [animating, setAnimating] = useState(false);

  const triggerAnimation = useCallback(() => {
    if (pendingJourneyMinutes <= 0) return;
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      clearPendingJourney();
    }, 800);
  }, [pendingJourneyMinutes, clearPendingJourney]);

  return { animating, pendingJourneyMinutes, triggerAnimation };
}

export function useHaptic() {
  return useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, []);
}

/**
 * Keeps `--keyboard-inset` on <html> equal to the height the on-screen keyboard
 * takes from the visual viewport, so a sticky footer can sit above it on iOS.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--keyboard-inset', `${inset}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}
