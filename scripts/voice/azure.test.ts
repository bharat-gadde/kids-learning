// scripts/voice/azure.test.ts
import { describe, it, expect } from 'vitest';
import { buildSsml, synthesize } from './azure';

describe('buildSsml', () => {
  it('wraps escaped text in the voice and prosody tags', () => {
    const ssml = buildSsml("Tom & Jerry's <big> day", 'en-IN-NeerjaNeural', '-10%');
    expect(ssml).toContain('<voice name="en-IN-NeerjaNeural">');
    expect(ssml).toContain('<prosody rate="-10%">Tom &amp; Jerry&apos;s &lt;big&gt; day</prosody>');
    expect(ssml.startsWith('<speak')).toBe(true);
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
    const headers = call.init.headers as Record<string, string>;
    expect(headers['Ocp-Apim-Subscription-Key']).toBe('k');
    expect(headers['X-Microsoft-OutputFormat']).toBe('audio-24khz-48kbitrate-mono-mp3');
    expect(headers['Content-Type']).toBe('application/ssml+xml');
    expect(String(call.init.body)).toContain('hello');
  });

  it('throws with the status and body on failure', async () => {
    const fakeFetch: typeof fetch = async () => new Response('bad key', { status: 401 });
    await expect(synthesize('x', cfg, fakeFetch)).rejects.toThrow('Azure TTS 401: bad key');
  });
});
