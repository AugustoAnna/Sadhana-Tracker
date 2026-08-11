/**
 * Maps practice slugs to illustration filenames in /public/illustrations/.
 * Copy assets from Google Drive into that folder (see docs/illustration-setup.md).
 * Filenames are expected to match the practice slug with .png or .webp extension.
 */

/** Practices with no supplied illustration — neutral placeholder only. */
export const PRACTICES_WITHOUT_ILLUSTRATION = new Set([
  'ardhasiddhasana',
  'bhakti-sadhana',
  'jala-neti',
  'knee-rotations',
  'thoppukarnam',
]);

export function getIllustrationUrl(practiceId: string): string | null {
  if (PRACTICES_WITHOUT_ILLUSTRATION.has(practiceId)) return null;
  return `/illustrations/${practiceId}.png`;
}

export function getIllustrationFallbackUrl(practiceId: string): string | null {
  if (PRACTICES_WITHOUT_ILLUSTRATION.has(practiceId)) return null;
  return `/illustrations/${practiceId}.webp`;
}
