// scripts/voice/azure.test.ts
import { describe, it, expect } from 'vitest';
import { AzureTtsError, buildSsml, parseRetryAfter, synthesize, synthesizeWithRetry, voiceLocale } from './azure';

describe('buildSsml', () => {
  it('wraps escaped text in the voice and prosody tags', () => {
    const ssml = buildSsml("Tom & Jerry's <big> day", 'en-IN-NeerjaNeural', '-10%');
    expect(ssml).toContain('<voice name="en-IN-NeerjaNeural">');
    expect(ssml).toContain('<prosody rate="-10%">Tom &amp; Jerry&apos;s &lt;big&gt; day</prosody>');
    expect(ssml.startsWith('<speak')).toBe(true);
  });

  it('builds the whole document Azure expects', () => {
    expect(buildSsml('hi', 'en-IN-NeerjaNeural', '-10%')).toBe(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-IN">' +
        '<voice name="en-IN-NeerjaNeural"><prosody rate="-10%">hi</prosody></voice></speak>',
    );
  });

  it('takes xml:lang from the voice', () => {
    expect(buildSsml('hi', 'en-GB-SoniaNeural', '0%')).toContain('xml:lang="en-GB"');
    expect(voiceLocale('sr-Latn-RS-NicholasNeural')).toBe('sr-Latn-RS');
    expect(voiceLocale('custom')).toBe('en-IN');
  });
});

describe('synthesize', () => {
  const cfg = { key: 'k', region: 'centralindia', voice: 'en-IN-NeerjaNeural', rate: '-10%' };

  it('posts SSML to the regional endpoint with the right headers and returns bytes', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    };
    const bytes = await synthesize('hello', cfg, fakeFetch);
    expect([...bytes]).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://centralindia.tts.speech.microsoft.com/cognitiveservices/v1');
    expect(call.init.method).toBe('POST');
    const headers = call.init.headers as Record<string, string>;
    expect(headers['Ocp-Apim-Subscription-Key']).toBe('k');
    expect(headers['X-Microsoft-OutputFormat']).toBe('audio-24khz-48kbitrate-mono-mp3');
    expect(headers['Content-Type']).toBe('application/ssml+xml');
    expect(headers['User-Agent']).toBe('buddy-voice');
    expect(call.init.body).toBe(buildSsml('hello', cfg.voice, cfg.rate));
  });

  it('throws with the status and body on failure', async () => {
    const fakeFetch: typeof fetch = async () => new Response('bad key', { status: 401 });
    await expect(synthesize('x', cfg, fakeFetch)).rejects.toThrow('Azure TTS 401: bad key');
  });

  it('carries the status and Retry-After, and treats an empty 200 as a failure', async () => {
    const throttled: typeof fetch = async () => new Response('slow down', { status: 429, headers: { 'Retry-After': '7' } });
    await expect(synthesize('x', cfg, throttled)).rejects.toMatchObject({ name: 'AzureTtsError', status: 429, retryAfterMs: 7000 });
    const empty: typeof fetch = async () => new Response(new Uint8Array([]), { status: 200 });
    await expect(synthesize('x', cfg, empty)).rejects.toThrow('empty audio');
  });

  it('refuses a URL as the region, and a key fetch would echo, before any request', async () => {
    let called = false;
    const fakeFetch: typeof fetch = async () => {
      called = true;
      return new Response(new Uint8Array([1]));
    };
    await expect(synthesize('x', { ...cfg, region: 'https://centralindia.api.cognitive.microsoft.com/' }, fakeFetch)).rejects.toThrow('region name');
    await expect(synthesize('x', { ...cfg, key: 'sec\nret' }, fakeFetch)).rejects.toThrow('AZURE_SPEECH_KEY contains spaces or control characters');
    expect(called).toBe(false);
  });
});

describe('parseRetryAfter', () => {
  it('reads seconds and HTTP dates', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('5')).toBe(5000);
    expect(parseRetryAfter('Tue, 06 Oct 2026 10:00:30 GMT', Date.parse('Tue, 06 Oct 2026 10:00:00 GMT'))).toBe(30_000);
    expect(parseRetryAfter('soon')).toBeUndefined();
  });
});

describe('synthesizeWithRetry', () => {
  const cfg = { key: 'k', region: 'centralindia', voice: 'en-IN-NeerjaNeural', rate: '-10%' };
  /** Answers with these statuses in turn, then with audio. */
  const answers = (statuses: number[], headers: Record<string, string> = {}): typeof fetch => {
    let i = 0;
    return async () => {
      const status = statuses[i++];
      return status === undefined ? new Response(new Uint8Array([9])) : new Response('busy', { status, headers });
    };
  };

  it('retries 429 and 5xx with exponential backoff', async () => {
    const waits: number[] = [];
    const bytes = await synthesizeWithRetry('x', cfg, { fetchImpl: answers([429, 503, 502]), sleep: async (ms) => void waits.push(ms) });
    expect([...bytes]).toEqual([9]);
    expect(waits).toEqual([2000, 4000, 8000]);
  });

  it('waits at least as long as Retry-After asks, up to the cap', async () => {
    const waits: number[] = [];
    await synthesizeWithRetry('x', cfg, { fetchImpl: answers([429, 429], { 'Retry-After': '30' }), maxDelayMs: 45_000, sleep: async (ms) => void waits.push(ms) });
    expect(waits).toEqual([30_000, 30_000]);
  });

  it('gives up after the retry budget, and never retries a 401', async () => {
    const sleep = async () => {};
    await expect(synthesizeWithRetry('x', cfg, { fetchImpl: answers([429, 429, 429]), retries: 2, sleep })).rejects.toBeInstanceOf(AzureTtsError);
    let calls = 0;
    const unauthorized: typeof fetch = async () => {
      calls += 1;
      return new Response('bad key', { status: 401 });
    };
    await expect(synthesizeWithRetry('x', cfg, { fetchImpl: unauthorized, sleep })).rejects.toThrow('Azure TTS 401: bad key');
    expect(calls).toBe(1);
  });

  it('retries a network failure', async () => {
    let calls = 0;
    const flaky: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('fetch failed');
      return new Response(new Uint8Array([1]));
    };
    const retried: number[] = [];
    await synthesizeWithRetry('x', cfg, { fetchImpl: flaky, sleep: async () => {}, onRetry: ({ attempt }) => void retried.push(attempt) });
    expect(calls).toBe(2);
    expect(retried).toEqual([1]);
    const broken: typeof fetch = async () => {
      throw new TypeError('Headers.append: invalid header value');
    };
    await expect(synthesizeWithRetry('x', cfg, { fetchImpl: broken, sleep: async () => {}, onRetry: ({ attempt }) => void retried.push(attempt) })).rejects.toThrow('Headers.append');
    expect(retried).toEqual([1]);
  });
});
