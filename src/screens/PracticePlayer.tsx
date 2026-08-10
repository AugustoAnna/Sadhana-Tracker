import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, PracticeIllustration } from '@/components';
import { isFeatureEnabled } from '@/features';
import { useAppStore, getDefaultLogMinutes } from '@/stores/appStore';
import { getPractice } from '@/data/catalogue';
import { getCachedAudio } from '@/services/audio';
import { track } from '@/services/instrumentation';

type PlayerPhase = 'practice' | 'transition' | 'done';

export function PracticePlayer() {
  const navigate = useNavigate();
  const playerSession = useAppStore((s) => s.playerSession);
  const setPlayerSession = useAppStore((s) => s.setPlayerSession);
  const logPractice = useAppStore((s) => s.logPractice);
  const addRecentSession = useAppStore((s) => s.addRecentSession);
  const instances = useAppStore((s) => s.instances);

  const sessionsEnabled = isFeatureEnabled('sessions');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<PlayerPhase>('practice');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [isGuided, setIsGuided] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const instanceIds = playerSession?.practiceInstanceIds ?? [];
  const currentInstanceId = instanceIds[currentIndex];
  const currentInstance = instances.find((i) => i.id === currentInstanceId);
  const currentPractice = currentInstance ? getPractice(currentInstance.practiceId) : null;
  const hasNextPractice = sessionsEnabled && currentIndex < instanceIds.length - 1;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const logCurrentPractice = useCallback(async () => {
    if (!currentInstance) return;
    await logPractice(
      currentInstance.id,
      getDefaultLogMinutes(currentInstance.practiceId),
      'player',
    );
  }, [currentInstance, logPractice]);

  const advance = useCallback(async () => {
    clearTimer();
    stopAudio();

    if (phase === 'practice') {
      await logCurrentPractice();
      if (hasNextPractice) {
        setPhase('transition');
        setSecondsLeft(5);
        return;
      }
      setPhase('done');
      return;
    }

    if (phase === 'transition') {
      setCurrentIndex((i) => i + 1);
      setPhase('practice');
    }
  }, [phase, hasNextPractice, logCurrentPractice, clearTimer, stopAudio]);

  useEffect(() => {
    if (!currentPractice || !currentInstance) return;

    const startPractice = async () => {
      if (currentPractice.type === 'guided') {
        setIsGuided(true);
        const audioUrl = await getCachedAudio(currentInstance.practiceId);
        const duration = (currentPractice.minutes ?? 10) * 60;
        setSecondsLeft(duration);
        setTotalSeconds(duration);
        setElapsedSeconds(0);

        if (audioUrl) {
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.play().catch(() => {});
          audio.onended = () => advance();
        }

        if (!paused) {
          timerRef.current = setInterval(() => {
            setSecondsLeft((s) => {
              setElapsedSeconds((e) => e + 1);
              if (s <= 1) {
                clearTimer();
                setTimeout(() => advance(), 0);
                return 0;
              }
              return s - 1;
            });
          }, 1000);
        }
      } else {
        setIsGuided(false);
      }
    };

    if (phase === 'practice') {
      startPractice();
    }

    return () => {
      clearTimer();
      stopAudio();
    };
  }, [currentIndex, phase, currentPractice?.id, currentInstance?.id, paused, advance, clearTimer, stopAudio]);

  useEffect(() => {
    if (phase !== 'transition') return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          advance();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return clearTimer;
  }, [phase, advance, clearTimer]);

  useEffect(() => {
    if (phase !== 'done') return;
    addRecentSession(instanceIds);
    setPlayerSession(null);
    navigate('/post-practice', { replace: true });
  }, [phase, instanceIds, addRecentSession, setPlayerSession, navigate]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setPaused(true);
        clearTimer();
        stopAudio();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [clearTimer, stopAudio]);

  if (!playerSession || !currentPractice) {
    return null;
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `-${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleLeave = () => {
    if (currentInstance && currentPractice) {
      track('practice_quit', {
        practice_id: currentInstance.practiceId,
        instance: currentInstance.instanceNumber,
        elapsed_seconds: elapsedSeconds,
        total_seconds: totalSeconds || (currentPractice.minutes ?? 10) * 60,
      });
    }
    setPlayerSession(null);
    navigate('/practice-home', { replace: true });
  };

  return (
    <div className="h-full bg-ground flex flex-col text-white">
      <div className="flex items-center justify-between px-4 pt-12">
        <button
          onClick={() => setLeaveOpen(true)}
          className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <p className="font-serif text-headline">Please keep your eyes closed</p>
        <div className="w-11" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {isGuided ? (
          <p className="text-display tabular-nums font-medium mb-6">{formatTime(secondsLeft)}</p>
        ) : (
          <button
            onClick={advance}
            className="px-8 py-3 rounded-xl bg-primary-light text-white font-semibold min-h-11 mb-6"
          >
            Mark completed
          </button>
        )}

        <div className="flex items-center gap-4 w-full max-w-sm">
          <div className="rounded-[12px] overflow-hidden shadow-lg flex-1">
            <PracticeIllustration practiceId={currentPractice.id} size={160} />
          </div>
          {hasNextPractice && (() => {
            const nextInst = instances.find((i) => i.id === instanceIds[currentIndex + 1]);
            const nextP = nextInst ? getPractice(nextInst.practiceId) : null;
            if (!nextP) return null;
            return (
              <PracticeIllustration practiceId={nextP.id} size={64} />
            );
          })()}
        </div>

        <p className="font-serif text-headline mt-6 text-center px-4">{currentPractice.name}</p>

        {hasNextPractice && (() => {
          const nextInst = instances.find((i) => i.id === instanceIds[currentIndex + 1]);
          const nextP = nextInst ? getPractice(nextInst.practiceId) : null;
          if (!nextP) return null;
          return <SkipHoldButton label={nextP.name} onComplete={advance} />;
        })()}

        {paused && isGuided && (
          <button
            onClick={() => setPaused(false)}
            className="mt-4 px-6 py-2 rounded-xl bg-white/20 font-medium"
          >
            Resume
          </button>
        )}
      </div>

      {sessionsEnabled && instanceIds.length > 1 && (
        <div className="flex justify-center gap-2 pb-8 safe-bottom">
          {instanceIds.map((id, i) => (
            <div
              key={id}
              className={`w-2 h-2 rounded-full ${
                i < currentIndex ? 'bg-white' : i === currentIndex ? 'bg-white/80 ring-2 ring-white' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      )}

      <Modal
        open={leaveOpen}
        title="Leave session"
        message="Nothing counts until the practice is complete."
        confirmLabel="Leave session"
        cancelLabel="Keep going"
        onConfirm={handleLeave}
        onCancel={() => setLeaveOpen(false)}
      />
    </div>
  );
}

function SkipHoldButton({ label, onComplete }: { label: string; onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    setProgress(0);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(elapsed / 2000, 1);
      setProgress(p);
      if (p >= 1) {
        if (timerRef.current) clearInterval(timerRef.current);
        onComplete();
      }
    }, 50);
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);
  };

  return (
    <button
      type="button"
      className="mt-6 relative px-4 py-2 rounded-xl border border-white/30 text-sm text-white/90 overflow-hidden"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
    >
      <span
        className="absolute inset-0 bg-white/20 origin-left"
        style={{ transform: `scaleX(${progress})` }}
      />
      <span className="relative">Skip to {label}</span>
    </button>
  );
}
