// scripts/art/compose.ts
import { z } from 'zod';

/** OpenMoji (https://openmoji.org), CC BY-SA 4.0: the open-licence pictures of spec §12, pinned to one release. */
export const OPENMOJI_VERSION = '17.0.0';
export const openMojiUrl = (hex: string): string => `https://cdn.jsdelivr.net/npm/openmoji@${OPENMOJI_VERSION}/color/svg/${hex}.svg`;

const HexSchema = z.string().regex(/^[0-9A-F]+(-[0-9A-F]+)*$/, 'an OpenMoji code, e.g. 1F34E');
const LayerSchema = z.strictObject({
  hex: HexSchema,
  x: z.number(),
  y: z.number(),
  size: z.number().positive(),
  flip: z.boolean().optional(),
});
const CompositionSchema = z.strictObject({
  viewBox: z.string().min(1).optional(),
  shapes: z.array(z.string().min(1)).optional(),
  layers: z.array(LayerSchema).min(1),
});

/** One OpenMoji picture placed in a composition: its 72×72 drawing scaled to `size`, top left at (x, y). */
export type Layer = z.infer<typeof LayerSchema>;
/** Several pictures in one file, over optional plain SVG shapes (a sky, a floor), in a 72×72 box unless `viewBox` says otherwise. */
export type Composition = z.infer<typeof CompositionSchema>;
/** An OpenMoji code (the file as published), or a composition. */
export type ArtSource = string | Composition;

/** art/openmoji.json, checked: a typo or a missing number names its entry instead of writing a broken picture. */
export function parseSources(json: unknown): Record<string, ArtSource> {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) throw new Error('art/openmoji.json: expected an object of picture paths');
  const sources: Record<string, ArtSource> = {};
  const problems: string[] = [];
  for (const [path, value] of Object.entries(json)) {
    if (!/^[\w-]+\/[\w-]+\.svg$/.test(path)) {
      problems.push(`${path}: not a picture path, e.g. objects/apple.svg`);
      continue;
    }
    const parsed = typeof value === 'string' ? HexSchema.safeParse(value) : CompositionSchema.safeParse(value);
    if (parsed.success) sources[path] = parsed.data;
    else problems.push(`${path}: ${z.prettifyError(parsed.error)}`);
  }
  if (problems.length > 0) throw new Error(`art/openmoji.json:\n${problems.join('\n')}`);
  return sources;
}

/**
 * The drawing inside an OpenMoji file, without its <svg> wrapper or ids (the same ids repeat in every file). Refuses a
 * file whose drawing is not 72×72 (each layer is placed in a 72×72 box) or refers to its own ids (stripped, the
 * reference would point at nothing).
 */
export function innerSvg(svg: string): string {
  const m = svg.match(/^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/);
  if (!m) throw new Error('not an SVG file');
  if (!/\bviewBox="0 0 72 72"/.test(m[1] as string)) throw new Error('expected an OpenMoji drawing, viewBox "0 0 72 72"');
  const inner = m[2] as string;
  if (/url\(#|href="#/.test(inner)) throw new Error('the drawing refers to its own ids, which composing removes');
  return inner.replace(/\s+id="[^"]*"/g, '').trim();
}

/** The composed SVG file: shapes first, then each layer in order (later layers draw on top). */
export function composeSvg(c: Composition, pictures: ReadonlyMap<string, string>): string {
  const layers = c.layers.map((l) => {
    const svg = pictures.get(l.hex);
    if (svg === undefined) throw new Error(`no picture for ${l.hex}`);
    const inner = innerSvg(svg);
    const drawing = l.flip ? `<g transform="matrix(-1 0 0 1 72 0)">${inner}</g>` : inner;
    return `<svg x="${l.x}" y="${l.y}" width="${l.size}" height="${l.size}" viewBox="0 0 72 72">${drawing}</svg>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${c.viewBox ?? '0 0 72 72'}">${[...(c.shapes ?? []), ...layers].join('')}</svg>\n`;
}

/** The OpenMoji codes a source needs. */
export const hexesOf = (s: ArtSource): string[] => (typeof s === 'string' ? [s] : s.layers.map((l) => l.hex));
