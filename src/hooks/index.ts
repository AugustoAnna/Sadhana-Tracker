import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';

export function useInViewport<T extends HTMLElement>(onEnter?: () => void) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && onEnter && !calledRef.current) {
          calledRef.current = true;
          onEnter();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onEnter]);

  return { ref, inView };
}

export function useJourneyAnimation() {
  const pendingJourneyMinutes = useAppStore((s) => s.pendingJourneyMinutes);
  const clearPendingJourney = useAppStore((s) => s.clearPendingJourney);
  const [animating, setAnimating] = useState(false);
  const [displayMinutes, setDisplayMinutes] = useState(0);

  const triggerAnimation = useCallback(() => {
    if (pendingJourneyMinutes <= 0) return;
    setAnimating(true);
    setDisplayMinutes(pendingJourneyMinutes);
    setTimeout(() => {
      setAnimating(false);
      clearPendingJourney();
    }, 800);
  }, [pendingJourneyMinutes, clearPendingJourney]);

  return { animating, displayMinutes, pendingJourneyMinutes, triggerAnimation };
}

export function useHaptic() {
  return useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, []);
}
