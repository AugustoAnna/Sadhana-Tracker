import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, PracticeIllustration } from '@/components';
import { useAppStore, getDefaultLogMinutes } from '@/stores/appStore';
import { getPractice } from '@/data/catalogue';
import { getResolvedKind } from '@/data/practiceAssets';
import { getPracticeAudio } from '@/services/audio';
import { track } from '@/services/instrumentation';

const TICK_MS = 500;
/** Wait this long between attempts to revive playback the OS suspended. */
const RESUME_RETRY_MS = 2000;
/** After this long without progress, finish the session on the clock instead. */
const STALL_GIVE_UP_MS = 30000;

export function PracticePlayer() {
  const navigate = useNavigate();
  const playerSession = useAppStore((s) => s.playerSession);
  const setPlayerSession = useAppStore((s) => s.setPlayerSession);
  const logPractice = useAppStore((s) => s.logPractice);
  const instances = useAppStore((s) => s.instances);

  const instanceIds = playerSession?.practiceInstanceIds ?? [];
  const currentInstanceId = instanceIds[0];
  const currentInstance = instances.find((i) => i.id === currentInstanceId);
  const currentPractice = currentInstance ? getPractice(currentInstance.practiceId) : null;
  const resolvedKind = currentPractice ? getResolvedKind(currentPractice.id) : null;

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [mode, setMode] = useState<'loading' | 'countdown' | 'manual'>('loading');
  const [needsResume, setNeedsResume] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);
  const sessionKeyRef = useRef<string | null>(null);
  const audioDrivenRef = useRef(false);
  const userPausedRef = useRef(false);
  const lastAdvanceRef = useRef({ time: 0, at: 0 });
  const lastResumeAttemptRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAudio = useCallback(() => {
    audioDrivenRef.current = false;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.removeAttribute('src');
      audio.load();
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
    }
  }, []);

  const finishAndReturn = useCallback(async () => {
    if (completedRef.current || !currentInstance || !currentPractice) return;
    completedRef.current = true;
    clearTimer();
    stopAudio();

    const minutes = resolvedKind === 'timed'
      ? (playerSession?.timedMinutes ?? currentPractice.minutes ?? 10)
      : getDefaultLogMinutes(currentInstance.practiceId);

    await logPractice(currentInstance.id, minutes, 'player');
    setPlayerSession(null);
    navigate('/practice-home', { replace: true });
  }, [
    currentInstance, currentPractice, resolvedKind, playerSession?.timedMinutes,
    logPractice, setPlayerSession, navigate, clearTimer, stopAudio,
  ]);

  const finishRef = useRef(finishAndReturn);
  finishRef.current = finishAndReturn;

  /** Count down against the wall clock so a throttled tab cannot stretch the session. */
  const startIntervalCountdown = useCallback((remainingSec: number, totalSec = remainingSec) => {
    setSecondsLeft(remainingSec);
    setTotalSeconds(totalSec);
    setElapsedSeconds(totalSec - remainingSec);
    setNeedsResume(false);
    setMode('countdown');

    clearTimer();
    const endsAt = Date.now() + remainingSec * 1000;
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      setElapsedSeconds(totalSec - left);
      if (left <= 0) {
        clearTimer();
        void finishRef.current();
      }
    }, TICK_MS);
  }, [clearTimer]);

  const resumeAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioDrivenRef.current) return;
    userPausedRef.current = false;
    lastResumeAttemptRef.current = Date.now();
    void audio.play().then(
      () => {
        setNeedsResume(false);
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      },
      () => setNeedsResume(true),
    );
  }, []);

  useEffect(() => {
    if (!currentPractice || !currentInstance || !resolvedKind || !playerSession) return;

    const sessionKey = `${currentInstance.id}:${playerSession.timedMinutes ?? ''}:${resolvedKind}`;
    if (sessionKeyRef.current === sessionKey) return;
    sessionKeyRef.current = sessionKey;
    completedRef.current = false;
    userPausedRef.current = false;
    setNeedsResume(false);
    setMode('loading');

    let cancelled = false;

    const init = async () => {
      if (resolvedKind === 'guided') {
        const audioUrl = await getPracticeAudio(currentInstance.practiceId);
        if (cancelled) return;

        const audio = audioRef.current;
        if (!audioUrl || !audio) {
          setMode('manual');
          return;
        }

        audio.src = audioUrl;

        await new Promise<void>((resolve) => {
          const done = () => resolve();
          audio.addEventListener('loadedmetadata', done, { once: true });
          audio.addEventListener('error', done, { once: true });
          audio.load();
        });
        if (cancelled) return;

        const duration = Number.isFinite(audio.duration) && audio.duration > 0
          ? Math.ceil(audio.duration)
          : (currentPractice.minutes ?? 10) * 60;

        setTotalSeconds(duration);
        setSecondsLeft(duration);
        setElapsedSeconds(0);
        setMode('countdown');

        audio.onended = () => void finishRef.current();

        try {
          await audio.play();
        } catch {
          startIntervalCountdown(duration);
          return;
        }
        if (cancelled) return;

        audioDrivenRef.current = true;
        lastAdvanceRef.current = { time: 0, at: Date.now() };
        lastResumeAttemptRef.current = 0;

        // Lock-screen controls also keep the OS treating this as an active
        // media session, which matters across the silent stretches of a
        // guided practice.
        if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: currentPractice.name,
            artist: 'Sadhana',
          });
          navigator.mediaSession.playbackState = 'playing';
          navigator.mediaSession.setActionHandler('play', () => resumeAudio());
          navigator.mediaSession.setActionHandler('pause', () => {
            userPausedRef.current = true;
            audioRef.current?.pause();
            navigator.mediaSession.playbackState = 'paused';
            setNeedsResume(true);
          });
        }

        clearTimer();
        timerRef.current = setInterval(() => {
          const el = audioRef.current;
          if (!el || !audioDrivenRef.current) return;

          const now = Date.now();
          const total = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : duration;
          const played = el.currentTime;

          setSecondsLeft(Math.max(0, Math.ceil(total - played)));
          setElapsedSeconds(Math.floor(played));

          if (el.ended || total - played <= 0) {
            clearTimer();
            void finishRef.current();
            return;
          }

          if (played > lastAdvanceRef.current.time + 0.05) {
            lastAdvanceRef.current = { time: played, at: now };
            setNeedsResume(false);
            return;
          }

          if (userPausedRef.current) return;

          // Phones suspend media that has gone quiet or dropped into the
          // background, and a guided practice can be silent for minutes at a
          // time. Nudge playback back rather than freezing on a dead clock.
          if (now - lastResumeAttemptRef.current >= RESUME_RETRY_MS) {
            lastResumeAttemptRef.current = now;
            void el.play().catch(() => setNeedsResume(true));
          }

          if (now - lastAdvanceRef.current.at >= STALL_GIVE_UP_MS) {
            audioDrivenRef.current = false;
            el.pause();
            startIntervalCountdown(Math.max(1, Math.ceil(total - played)), Math.ceil(total));
          }
        }, TICK_MS);
      } else if (resolvedKind === 'timed') {
        const duration = (playerSession.timedMinutes ?? currentPractice.minutes ?? 10) * 60;
        startIntervalCountdown(duration);
      } else {
        setMode('manual');
      }
    };

    void init();

    return () => {
      cancelled = true;
      clearTimer();
      stopAudio();
      sessionKeyRef.current = null;
    };
  }, [
    currentInstance?.id,
    currentPractice?.id,
    resolvedKind,
    playerSession?.timedMinutes,
    clearTimer,
    stopAudio,
    startIntervalCountdown,
    resumeAudio,
  ]);

  // Coming back to the screen is the first moment a suspended element can be
  // revived, so retry there instead of waiting for the next tick.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (audioDrivenRef.current && !userPausedRef.current && audioRef.current?.paused) {
        resumeAudio();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [resumeAudio]);

  // Keeping the screen awake avoids the lock that suspends playback to begin with.
  useEffect(() => {
    if (mode !== 'countdown' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let dropped = false;

    const acquire = () => {
      navigator.wakeLock.request('screen').then(
        (lock) => {
          if (dropped) void lock.release().catch(() => {});
          else sentinel = lock;
        },
        () => {},
      );
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !dropped) acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      dropped = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [mode]);

  if (!playerSession || !currentPractice || !currentInstance) {
    return null;
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `-${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleLeave = () => {
    track('practice_quit', {
      practice_id: currentInstance.practiceId,
      instance: currentInstance.instanceNumber,
      elapsed_seconds: elapsedSeconds,
      total_seconds: totalSeconds || (currentPractice.minutes ?? 10) * 60,
    });
    setPlayerSession(null);
    navigate('/practice-home', { replace: true });
  };

  return (
    <div
      className="h-full flex flex-col text-white"
      style={{
        background: 'var(--gradient-player)',
      }}
    >
      <audio ref={audioRef} className="hidden" preload="auto" playsInline />

      <div className="flex items-center justify-between px-4 pt-8 pb-2">
        <button
          onClick={() => setLeaveOpen(true)}
          className="w-11 h-11 rounded-full bg-white/25 flex items-center justify-center"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <p className="font-serif text-[22px] text-center flex-1 px-2">{currentPractice.name}</p>
        <div className="w-11" />
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pt-6 pb-10">
        <div className="flex-1 flex items-center justify-center w-full max-w-[240px]">
          <PracticeIllustration
            practiceId={currentPractice.id}
            size={200}
            className="!w-full !h-auto max-w-[200px] aspect-square"
          />
        </div>

        <div className="shrink-0 w-full flex flex-col items-center gap-4 min-h-[44px]">
          {mode === 'countdown' && (
            <p className="text-[28px] tabular-nums font-medium">{formatTime(secondsLeft)}</p>
          )}
          {mode === 'countdown' && needsResume && (
            <button
              onClick={resumeAudio}
              className="px-8 py-3 rounded-xl bg-white/20 font-semibold min-h-11 text-lg flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Resume
            </button>
          )}
          {mode === 'manual' && (
            <button
              onClick={() => void finishAndReturn()}
              className="px-8 py-3 rounded-xl bg-white/20 font-semibold min-h-11 text-lg"
            >
              Mark completed
            </button>
          )}
        </div>
      </div>

      <Modal
        open={leaveOpen}
        dark
        title="Leaving the session?"
        message="Nothing counts until the practice is complete."
        confirmLabel="Leave session"
        cancelLabel="Stay"
        onConfirm={handleLeave}
        onCancel={() => setLeaveOpen(false)}
      />
    </div>
  );
}
