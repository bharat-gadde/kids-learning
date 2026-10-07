// src/app/audio/setup.ts
import { Howl } from 'howler';
import { HowlerClipPlayer, type HowlCtor } from '../../engine/audio/howlerPlayer';
import { AudioManager } from '../../engine/audio/manager';
import { EMPTY_MANIFEST, ManifestClipSource, type ClipManifest } from '../../engine/audio/manifest';
import { createWebSpeechTts, pickVoice, type VoiceLike } from '../../engine/audio/tts';
import type { ContentPack } from '../../engine/content/load';

/**
 * The voice clips' manifest, from under the site's base path (a GitHub Pages project site lives under /<repo>/, where
 * '/audio/…' would 404 and every line fall back to TTS without an error). No manifest means TTS for every line.
 */
export async function loadManifest(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<ClipManifest> {
  try {
    const res = await fetchFn(`${baseUrl}audio/manifest.json`);
    if (!res.ok) return EMPTY_MANIFEST;
    const m = (await res.json()) as Partial<ClipManifest> | null;
    return m?.version === 1 && m.clips && typeof m.clips === 'object' ? (m as ClipManifest) : EMPTY_MANIFEST;
  } catch {
    return EMPTY_MANIFEST;
  }
}

/** Spec §7's chain: clips under `${baseUrl}audio/lines` through Howler, then the device's speech. */
export function createAudioManager(pack: ContentPack, manifest: ClipManifest, baseUrl: string): AudioManager {
  return new AudioManager({
    pack,
    clips: new ManifestClipSource(manifest, `${baseUrl}audio/lines`),
    player: new HowlerClipPlayer(Howl as unknown as HowlCtor),
    tts: createWebSpeechTts(),
  });
}

/** An empty WAV: enough to build a Howl that never plays. */
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

/**
 * Call at start-up. Howler registers its unlock listeners only when the first Howl is built, and that unlock fills its
 * html5 pool; a clip built before the child's first tap could otherwise fail and fall through to TTS.
 */
export function primeHowler(): void {
  new Howl({ src: [SILENCE], format: ['wav'], html5: true, preload: false });
}

/**
 * Call inside the child's first tap, before any await: iOS Safari ignores speak() outside a gesture until one has run
 * inside one (and fires no event to say so); Chrome reports 'not-allowed'.
 */
export function unlockSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance('');
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

/**
 * Chrome lists no voices until 'voiceschanged': ask at start-up. Logs the voice TTS will use on this device (macOS and
 * iOS list novelty voices; Chrome's network voices fail offline) — worth checking once per tablet.
 */
export function primeVoices(log: (message: string) => void = console.info): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const report = () => {
    const voices = window.speechSynthesis.getVoices() as unknown as VoiceLike[];
    if (voices.length > 0) log(`speech voice: ${pickVoice(voices, ['en-IN', 'en-GB', 'en-US', 'en'])?.name ?? 'none in English'}`);
  };
  report();
  window.speechSynthesis.addEventListener?.('voiceschanged', report, { once: true });
}

/** Stop speaking when the app is hidden (another app, a locked screen). Returns the unsubscribe. */
export function stopWhenHidden(stop: () => void, doc: Document = document): () => void {
  const onChange = () => {
    if (doc.visibilityState === 'hidden') stop();
  };
  doc.addEventListener('visibilitychange', onChange);
  return () => doc.removeEventListener('visibilitychange', onChange);
}
