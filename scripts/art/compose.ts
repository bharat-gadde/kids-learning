// scripts/art/compose.ts
/** OpenMoji (https://openmoji.org), CC BY-SA 4.0: the open-licence pictures of spec §12, pinned to one release. */
export const OPENMOJI_VERSION = '17.0.0';
export const openMojiUrl = (hex: string): string => `https://cdn.jsdelivr.net/npm/openmoji@${OPENMOJI_VERSION}/color/svg/${hex}.svg`;

/** One OpenMoji picture placed in a composition: its 72×72 drawing scaled to `size`, top left at (x, y). */
export interface Layer {
  hex: string;
  x: number;
  y: number;
  size: number;
  /** mirror it left to right */
  flip?: boolean;
}
/** Several pictures in one file, over optional plain SVG shapes (a sky, a floor), in a 72×72 box unless `viewBox` says otherwise. */
export interface Composition {
  viewBox?: string;
  shapes?: string[];
  layers: Layer[];
}
/** An OpenMoji code (the file as published), or a composition. */
export type ArtSource = string | Composition;

/** The drawing inside an OpenMoji file, without its <svg> wrapper or ids (the same ids repeat in every file). */
export function innerSvg(svg: string): string {
  const m = svg.match(/<svg\b[^>]*>([\s\S]*)<\/svg>\s*$/);
  if (!m) throw new Error('not an SVG file');
  return (m[1] as string).replace(/\s+id="[^"]*"/g, '').trim();
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
