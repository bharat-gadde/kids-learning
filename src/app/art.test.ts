// src/app/art.test.ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP = fileURLToPath(new URL('.', import.meta.url));
const ART = fileURLToPath(new URL('../../public/art/', import.meta.url));

/** The app's own source files: no tests, no test helpers. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'testing' ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('the pictures the app names in its own code', () => {
  it('are all in public/art — icons, islands, vignette parts (validate checks the content\'s)', () => {
    // a renamed path would show a blank stand-in, and jsdom never fires the image's error. Any folder, so new art is
    // covered; but `vignettes/…` are the keys of the composed vignettes (scenario/vignettes.ts), not files.
    const literal = /['"`](?!vignettes\/)([\w-]+\/[\w-]+\.svg)['"`]/g;
    const named = new Set(sources(APP).flatMap((file) => [...readFileSync(file, 'utf8').matchAll(literal)].map((m) => m[1] as string)));
    expect(named.size).toBeGreaterThan(28);
    for (const path of named) expect(existsSync(ART + path), path).toBe(true);
  });
});
