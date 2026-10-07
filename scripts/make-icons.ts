// scripts/make-icons.ts
// Renders the app icons (home screen, install, favicon) from public/icons/icon.svg and maskable.svg.
// Usage: npm run icons   (the PNGs are committed; run again after changing the SVGs)
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const ICONS = new URL('../public/icons/', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, ICONS), 'utf8');
const icon = read('icon.svg');
const maskable = read('maskable.svg');

const out: Array<[file: string, svg: string, size: number]> = [
  ['apple-touch-icon.png', icon, 180], // iOS home screen
  ['icon-192.png', icon, 192],
  ['icon-512.png', icon, 512],
  ['maskable-512.png', maskable, 512], // Android crops it to its own shape: Buddy stays inside the safe circle
];
for (const [file, svg, size] of out) {
  writeFileSync(new URL(file, ICONS), new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng());
}
console.log(`${out.length} icons written to public/icons`);
