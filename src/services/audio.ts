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

export function getPlaceholderAudioUrl(_practiceId: string): string {
  // Placeholder — replace with real audio URLs when available
  return `/audio/placeholder.mp3`;
}

export async function precacheInvocation(): Promise<void> {
  // Placeholder — invocation audio cached during onboarding
  try {
    await cacheAudio('invocation', '/audio/invocation.mp3');
  } catch {
    // offline or missing file — acceptable for first draft
  }
}
