import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, PracticeIllustration } from '@/components';
import { useAppStore, getDefaultLogMinutes } from '@/stores/appStore';
import { getPractice } from '@/data/catalogue';
import { getCachedAudio } from '@/services/audio';

type PlayerPhase = 'invocation-open' | 'practice' | 'transition' | 'invocation-close' | 'done';

export function PracticePlayer() {
  const navigate = useNavigate();
  const playerSession = useAppStore((s) => s.playerSession);
  const setPlayerSession = useAppStore((s) => s.setPlayerSession);
  const logPractice = useAppStore((s) => s.logPractice);
  const addRecentSession = useAppStore((s) => s.addRecentSession);
  const instances = useAppStore((s) => s.instances);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<PlayerPhase>('practice');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [isGuided, setIsGuided] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const instanceIds = playerSession?.practiceInstanceIds ?? [];
  const includeInvocation = playerSession?.includeInvocation ?? false;
  const currentInstanceId = instanceIds[currentIndex];
  const currentInstance = instances.find((i) => i.id === currentInstanceId);
  const currentPractice = currentInstance ? getPractice(currentInstance.practiceId) : null;

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
    const minutes = currentPractice?.type === 'timed'
      ? getDefaultLogMinutes(currentInstance.practiceId)
      : getDefaultLogMinutes(currentInstance.practiceId);
    await logPractice(currentInstance.id, minutes, 'player');
  }, [currentInstance, currentPractice, logPractice]);

  const advance = useCallback(async () => {
    clearTimer();
    stopAudio();

    if (phase === 'invocation-open') {
      setPhase('practice');
      return;
    }

    if (phase === 'practice') {
      await logCurrentPractice();
      if (currentIndex < instanceIds.length - 1) {
        setPhase('transition');
        setSecondsLeft(5);
        return;
      }
      if (includeInvocation) {
        setPhase('invocation-close');
        return;
      }
      setPhase('done');
      return;
    }

    if (phase === 'transition') {
      setCurrentIndex((i) => i + 1);
      setPhase('practice');
      return;
    }

    if (phase === 'invocation-close') {
      setPhase('done');
      return;
    }
  }, [phase, currentIndex, instanceIds.length, includeInvocation, logCurrentPractice, clearTimer, stopAudio]);

  // Start practice
  useEffect(() => {
    if (!currentPractice || !currentInstance) return;

    const startPractice = async () => {
      if (currentPractice.type === 'guided') {
        setIsGuided(true);
        const audioUrl = await getCachedAudio(currentInstance.practiceId);
        const duration = (currentPractice.minutes ?? 10) * 60;
        setSecondsLeft(duration);

        if (audioUrl) {
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.play().catch(() => {});
          audio.onended = () => advance();
        }

        if (!paused) {
          timerRef.current = setInterval(() => {
            setSecondsLeft((s) => {
              if (s <= 1) {
                clearTimer();
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
      if (currentIndex === 0 && includeInvocation && phase === 'practice') {
        // Check if we need opening invocation - only on first load
      }
      startPractice();
    }

    return () => {
      clearTimer();
      stopAudio();
    };
  }, [currentIndex, phase, currentPractice?.id]);

  // Transition countdown
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
  }, [phase]);

  // Done
  useEffect(() => {
    if (phase === 'done') {
      addRecentSession(instanceIds);
      setPlayerSession(null);
      navigate('/post-practice', { replace: true });
    }
  }, [phase]);

  // Pause on background
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
  }, []);

  if (!playerSession || !currentPractice) {
    return null;
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `-${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleLeave = () => {
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
        <div className="mb-6 rounded-[12px] overflow-hidden shadow-lg">
          <PracticeIllustration practiceId={currentPractice.id} size={192} />
        </div>
        <p className="font-serif text-headline mb-8 text-center px-4">{currentPractice.name}</p>

        {isGuided ? (
          <p className="text-display tabular-nums font-medium">{formatTime(secondsLeft)}</p>
        ) : (
          <button
            onClick={advance}
            className="px-8 py-3 rounded-xl bg-primary-light text-white font-semibold min-h-11"
          >
            Mark Completed
          </button>
        )}

        {paused && isGuided && (
          <button
            onClick={() => setPaused(false)}
            className="mt-4 px-6 py-2 rounded-xl bg-white/20 font-medium"
          >
            Resume
          </button>
        )}
      </div>

      {/* Session progress indicator */}
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

      <Modal
        open={leaveOpen}
        title="Leave session?"
        message="Your completed practices will be saved. The current practice will not be logged."
        confirmLabel="Leave"
        onConfirm={handleLeave}
        onCancel={() => setLeaveOpen(false)}
      />
    </div>
  );
}
