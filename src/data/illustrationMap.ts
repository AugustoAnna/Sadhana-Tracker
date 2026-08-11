/**
 * Maps practice slugs to illustration filenames in /public/illustrations/.
 * Runtime resolution prefers build manifest (see practiceAssets.ts).
 */

/** Practices with no supplied illustration — neutral placeholder only. */
export const PRACTICES_WITHOUT_ILLUSTRATION = new Set([
  'ardhasiddhasana',
  'bhakti-sadhana',
  'jala-neti',
  'knee-rotations',
  'thoppukarnam',
]);

export function getIllustrationFallbackUrl(practiceId: string): string | null {
  if (PRACTICES_WITHOUT_ILLUSTRATION.has(practiceId)) return null;
  return `/illustrations/${practiceId}.webp`;
}
