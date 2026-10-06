// scripts/voice/azure.ts
export interface AzureConfig {
  key: string;
  region: string;
  voice: string;
  /** SSML prosody rate, e.g. "-10%" — slightly slower than default for a 4-year-old */
  rate: string;
}

/** gen-voice puts this in every clip's hash, so changing the format regenerates the clips. */
export const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** "en-IN-NeerjaNeural" → "en-IN", "sr-Latn-RS-NicholasNeural" → "sr-Latn-RS"; en-IN when the name has no locale. */
export function voiceLocale(voice: string): string {
  return /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?-[A-Z]{2}(?=-)/.exec(voice)?.[0] ?? 'en-IN';
}

export function buildSsml(text: string, voice: string, rate: string): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voiceLocale(voice)}">` +
    `<voice name="${escapeXml(voice)}"><prosody rate="${escapeXml(rate)}">${escapeXml(text)}</prosody></voice></speak>`
  );
}

/** A failed call. Carries the status and any Retry-After so a caller can back off; never carries the key. */
export class AzureTtsError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | undefined;
  constructor(status: number, body: string, retryAfterMs?: number) {
    super(`Azure TTS ${status}: ${body.slice(0, 300)}`);
    this.name = 'AzureTtsError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Retry-After is delay-seconds or an HTTP date. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

function assertConfig(cfg: AzureConfig): void {
  // The portal shows the endpoint URL next to the region; pasted here it would send the key to another host.
  if (!/^[a-z0-9]+$/.test(cfg.region)) throw new Error('AZURE_SPEECH_REGION must be a region name such as "centralindia", not a URL');
  // fetch quotes an invalid header value in its error message, which would print the key.
  if (!/^[\x21-\x7e]+$/.test(cfg.key)) throw new Error('AZURE_SPEECH_KEY contains spaces or control characters');
}

/** One call to the Azure Speech REST API; returns MP3 bytes. */
export async function synthesize(text: string, cfg: AzureConfig, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  assertConfig(cfg);
  const response = await fetchImpl(`https://${cfg.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': cfg.key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
      'User-Agent': 'buddy-voice',
    },
    body: buildSsml(text, cfg.voice, cfg.rate),
  });
  if (!response.ok) throw new AzureTtsError(response.status, await response.text(), parseRetryAfter(response.headers.get('retry-after')));
  const bytes = new Uint8Array(await response.arrayBuffer());
  // An empty file would be recorded as up to date and never regenerated.
  if (bytes.length === 0) throw new AzureTtsError(response.status, 'empty audio');
  return bytes;
}

export interface RetryOptions {
  /** Retries after the first attempt. The defaults wait 2+4+8+16+32+60 s, longer than F0's 20-per-60-s window. */
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
  fetchImpl?: typeof fetch;
}

/** 429 (quota, or Azure still scaling up) and 5xx are worth another try; so is fetch's own network failure. */
export function isRetryable(error: unknown): boolean {
  if (error instanceof AzureTtsError) return error.status === 429 || error.status >= 500;
  return error instanceof TypeError && error.message === 'fetch failed';
}

/** synthesize with exponential backoff that never waits less than Azure's Retry-After. */
export async function synthesizeWithRetry(text: string, cfg: AzureConfig, opts: RetryOptions = {}): Promise<Uint8Array> {
  const { retries = 6, baseDelayMs = 2000, maxDelayMs = 60_000, onRetry, fetchImpl = fetch } = opts;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await synthesize(text, cfg, fetchImpl);
    } catch (error) {
      if (attempt > retries || !isRetryable(error)) throw error;
      const hinted = error instanceof AzureTtsError ? (error.retryAfterMs ?? 0) : 0;
      const delayMs = Math.min(maxDelayMs, Math.max(baseDelayMs * 2 ** (attempt - 1), hinted));
      onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }
}
