import manifest from './generated/assetManifest.json';
import type { PracticeType } from '@/types';
import { PRACTICES } from './catalogue';
import { getMasterKind } from './masterKinds';
import { PRACTICES_WITHOUT_ILLUSTRATION } from './illustrationMap';

export interface AssetManifest {
  generatedAt: string;
  illustrations: Record<string, string[]>;
  audio: Record<string, string[]>;
  programs: Record<string, ProgramJson>;
  illustrationFileCount: number;
  audioFileCount: number;
  programFileCount: number;
}

export interface ProgramJson {
  practiceId?: string;
  id?: string;
  kind?: PracticeType;
  audioPath?: string;
  audio_path?: string;
  defaultMinutes?: number;
}

const M = manifest as AssetManifest;

function firstPath(map: Record<string, string[]>, id: string): string | null {
  const paths = map[id];
  return paths?.[0] ?? null;
}

function programAudioPath(id: string): string | null {
  const program = M.programs[id];
  if (!program) return null;
  return program.audioPath ?? program.audio_path ?? null;
}

export function resolveIllustrationUrl(practiceId: string): string | null {
  if (PRACTICES_WITHOUT_ILLUSTRATION.has(practiceId)) return null;
  return firstPath(M.illustrations, practiceId);
}

export function resolveAudioUrl(practiceId: string): string | null {
  const fromProgram = programAudioPath(practiceId);
  if (fromProgram) return fromProgram;
  return firstPath(M.audio, practiceId);
}

export function hasIllustrationAsset(practiceId: string): boolean {
  return resolveIllustrationUrl(practiceId) !== null;
}

export function hasAudioAsset(practiceId: string): boolean {
  return resolveAudioUrl(practiceId) !== null;
}

export function getResolvedKind(practiceId: string): PracticeType {
  const program = M.programs[practiceId];
  if (program?.kind) return program.kind;
  return getMasterKind(practiceId);
}

export interface PracticeAssetRow {
  id: string;
  name: string;
  illustration: boolean;
  audio: boolean;
  kind: PracticeType;
  illustrationPath: string | null;
  audioPath: string | null;
  note?: string;
}

export function buildPracticeAssetTable(): PracticeAssetRow[] {
  return PRACTICES.map((p) => {
    const kind = getResolvedKind(p.id);
    const illustrationPath = resolveIllustrationUrl(p.id);
    const audioPath = resolveAudioUrl(p.id);
    let note: string | undefined;
    if (kind === 'guided' && !audioPath) {
      note = 'Master guided — audio file missing at build';
    }
    return {
      id: p.id,
      name: p.name,
      illustration: illustrationPath !== null,
      audio: audioPath !== null,
      kind,
      illustrationPath,
      audioPath,
      note,
    };
  });
}

export function getManifestStats() {
  return {
    generatedAt: M.generatedAt,
    illustrationFileCount: M.illustrationFileCount,
    audioFileCount: M.audioFileCount,
    programFileCount: M.programFileCount,
  };
}

export { M as assetManifest };
