import { resolveAudioUrl } from '@/data/practiceAssets';

const AUDIO_CACHE = 'practice-audio-v1';

export async function cacheAudio(practiceId: string, url: string): Promise<void> {
  const cache = await caches.open(AUDIO_CACHE);
  const response = await fetch(url);
  if (response.ok) {
    await cache.put(`/audio/${practiceId}`, response);
  }
}

export async function getCachedAudio(practiceId: string): Promise<string | null> {
  const cache = await caches.open(AUDIO_CACHE);
  const response = await cache.match(`/audio/${practiceId}`);
  if (response) {
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }
  return null;
}

export async function isAudioCached(practiceId: string): Promise<boolean> {
  const cache = await caches.open(AUDIO_CACHE);
  const response = await cache.match(`/audio/${practiceId}`);
  return !!response;
}

/** Load audio from cache or public URL; cache on success. */
export async function getPracticeAudio(practiceId: string): Promise<string | null> {
  const cached = await getCachedAudio(practiceId);
  if (cached) return cached;

  const url = resolveAudioUrl(practiceId);
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    await cacheAudio(practiceId, url);
    return URL.createObjectURL(await response.blob());
  } catch {
    return null;
  }
}

export async function precachePracticeAudio(practiceId: string): Promise<boolean> {
  const url = resolveAudioUrl(practiceId);
  if (!url) return false;
  try {
    await cacheAudio(practiceId, url);
    return true;
  } catch {
    return false;
  }
}

export async function precacheInvocation(): Promise<void> {
  try {
    await cacheAudio('invocation', '/audio/invocation.mp3');
  } catch {
    // optional lab asset
  }
}
