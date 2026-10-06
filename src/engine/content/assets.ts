// src/engine/content/assets.ts
import type { ContentPack } from './load';

/** A `glyph:` asset is drawn as text (RoundItem.asset, a topic signpost), not loaded from a file. */
export const isGlyphAsset = (asset: string): boolean => asset.startsWith('glyph:');

/**
 * Every picture file the pack refers to, as a path inside the art folder (`public/art/`): topic signposts, objects,
 * scenes and bins, in pack order, without duplicates. Scenario vignettes are not files: the app composes them,
 * because Buddy, in the colour the child chose, acts in them.
 */
export function assetPaths(pack: ContentPack): string[] {
  const all = [
    ...[...pack.topics.values()].map((t) => t.asset),
    ...[...pack.objects.values()].map((o) => o.asset),
    ...[...pack.scenes.values()].map((s) => s.asset),
    ...[...pack.templates.values()].flatMap((t) => (t.bins ?? []).map((b) => b.asset)),
  ];
  return [...new Set(all.filter((a): a is string => a !== undefined && !isGlyphAsset(a)))];
}
