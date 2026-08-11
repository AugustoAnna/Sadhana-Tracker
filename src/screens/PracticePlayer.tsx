import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, PracticeIllustration } from '@/components';
import { useAppStore, getDefaultLogMinutes } from '@/stores/appStore';
import { getPractice } from '@/data/catalogue';
import { getResolvedKind } from '@/data/practiceAssets';
import { getPracticeAudio } from '@/services/audio';
import { track } from '@/services/instrumentation';

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
  const [audioMissing, setAudioMissing] = useState(false);
  const [ready, setReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

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

  const startCountdown = useCallback((durationSec: number) => {
    setSecondsLeft(durationSec);
    setTotalSeconds(durationSec);
    setElapsedSeconds(0);
    setReady(true);

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearTimer();
          void finishAndReturn();
          return 0;
        }
        setElapsedSeconds((e) => e + 1);
        return s - 1;
      });
    }, 1000);
  }, [clearTimer, finishAndReturn]);

  useEffect(() => {
    if (!currentPractice || !currentInstance || !resolvedKind) return;
    completedRef.current = false;

    const init = async () => {
      if (resolvedKind === 'guided') {
        const audioUrl = await getPracticeAudio(currentInstance.practiceId);
        if (!audioUrl) {
          setAudioMissing(true);
          setReady(true);
          return;
        }

        setAudioMissing(false);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        await new Promise<void>((resolve) => {
          audio.addEventListener('loadedmetadata', () => resolve(), { once: true });
          audio.addEventListener('error', () => resolve(), { once: true });
          audio.load();
        });

        const duration = Number.isFinite(audio.duration) && audio.duration > 0
          ? Math.ceil(audio.duration)
          : (currentPractice.minutes ?? 10) * 60;

        audio.play().catch(() => {});
        audio.onended = () => void finishAndReturn();
        startCountdown(duration);
      } else if (resolvedKind === 'timed') {
        const duration = (playerSession?.timedMinutes ?? currentPractice.minutes ?? 10) * 60;
        startCountdown(duration);
      } else {
        setReady(true);
        setAudioMissing(true);
      }
    };

    void init();

    return () => {
      clearTimer();
      stopAudio();
    };
  }, [
    currentPractice?.id, currentInstance?.id, resolvedKind,
    playerSession?.timedMinutes, startCountdown, finishAndReturn, clearTimer, stopAudio,
  ]);

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

  const showCountdown = ready && (
    (resolvedKind === 'guided' && !audioMissing) ||
    resolvedKind === 'timed'
  );

  const showMarkCompleted = ready && (
    (resolvedKind === 'guided' && audioMissing) ||
    resolvedKind === 'unguided'
  );

  return (
    <div
      className="h-full flex flex-col text-white"
      style={{
        background: 'radial-gradient(ellipse at center, #A88B34 0%, #7D6528 100%)',
      }}
    >
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

        <div className="shrink-0 w-full flex flex-col items-center">
          {showCountdown && (
            <p className="text-[28px] tabular-nums font-medium">{formatTime(secondsLeft)}</p>
          )}
          {showMarkCompleted && (
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
