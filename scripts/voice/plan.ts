// scripts/voice/plan.ts
import { createHash } from 'node:crypto';
import type { ContentPack } from '../../src/engine/content/load';
import { allTextClips } from '../../src/engine/audio/lines';
import type { ClipManifest } from '../../src/engine/audio/manifest';

export function clipHash(voice: string, text: string): string {
  return createHash('sha256').update(`${voice}|${text}`).digest('hex').slice(0, 16);
}

export interface PlannedClip {
  clipId: string;
  text: string;
  hash: string;
  file: string;
}

export interface ClipPlan {
  needed: PlannedClip[];
  unchanged: PlannedClip[];
  /** manifest entries no line needs any more */
  orphans: string[];
}

/** Compare what the pack needs with what the manifest already has. Pure; no network. */
export function planClips(pack: ContentPack, manifest: ClipManifest, voice: string): ClipPlan {
  const wanted = allTextClips(pack).map((c): PlannedClip => ({ clipId: c.clipId, text: c.text, hash: clipHash(voice, c.text), file: `${c.clipId}.mp3` }));
  const needed: PlannedClip[] = [];
  const unchanged: PlannedClip[] = [];
  for (const clip of wanted) {
    const existing = manifest.clips[clip.clipId];
    if (existing && existing.hash === clip.hash) unchanged.push(clip);
    else needed.push(clip);
  }
  const wantedIds = new Set(wanted.map((c) => c.clipId));
  const orphans = Object.keys(manifest.clips).filter((id) => !wantedIds.has(id));
  return { needed, unchanged, orphans };
}

/** Manifest clips generated from text the pack no longer has (spec §7's stale clips; `npm run validate` warns about them). */
export function staleClips(pack: ContentPack, manifest: ClipManifest): string[] {
  return allTextClips(pack)
    .filter((c) => {
      const entry = manifest.clips[c.clipId];
      return entry !== undefined && entry.text !== c.text;
    })
    .map((c) => c.clipId);
}
