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
  const [audioMissing, setAudioMissing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const instanceIds = playerSession?.practiceInstanceIds ?? [];
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
      if (sessionsEnabled && currentIndex < instanceIds.length - 1) {
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
  }, [phase, sessionsEnabled, currentIndex, instanceIds.length, logCurrentPractice, clearTimer, stopAudio]);

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
        setAudioMissing(!audioUrl);

        if (audioUrl) {
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.play().catch(() => {});
          audio.onended = () => advance();
        }

        if (!paused && audioUrl) {
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
    if (phase !== 'done') return;
    addRecentSession(instanceIds);
    setPlayerSession(null);
    navigate('/post-practice', { replace: true });
  }, [phase, instanceIds, addRecentSession, setPlayerSession, navigate]);

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
    <div
      className="h-full flex flex-col text-white"
      style={{
        background: 'radial-gradient(ellipse at center, #A88B34 0%, #7D6528 100%)',
      }}
    >
      <div className="flex items-center justify-between px-4 pt-10">
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

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <div
          className="rounded-[4px] p-3 mb-8"
          style={{ backgroundColor: '#7A4A2A', width: 'min(55vw, 220px)' }}
        >
          <PracticeIllustration
            practiceId={currentPractice.id}
            size={200}
            className="w-full !h-auto aspect-square !rounded-[2px]"
          />
        </div>

        {isGuided && !audioMissing ? (
          <p className="text-[28px] tabular-nums font-medium">{formatTime(secondsLeft)}</p>
        ) : (
          <button
            onClick={advance}
            className="px-8 py-3 rounded-xl bg-white/20 font-semibold min-h-11 text-lg"
          >
            Mark completed
          </button>
        )}

        {paused && isGuided && !audioMissing && (
          <button
            onClick={() => setPaused(false)}
            className="mt-4 px-6 py-2 rounded-xl bg-white/20 font-medium"
          >
            Resume
          </button>
        )}
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
