/**
 * Illustration exclusions are generated at build time into assetManifest.json.
 * This set is a fallback when manifest is stale.
 */
export const PRACTICES_WITHOUT_ILLUSTRATION = new Set<string>();

export function getIllustrationFallbackUrl(_practiceId: string): string | null {
  return null;
}
