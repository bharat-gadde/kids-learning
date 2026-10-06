// scripts/voice/azure.ts
export interface AzureConfig {
  key: string;
  region: string;
  voice: string;
  /** SSML prosody rate, e.g. "-10%" — slightly slower than default for a 4-year-old */
  rate: string;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function buildSsml(text: string, voice: string, rate: string): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-IN">` +
    `<voice name="${voice}"><prosody rate="${rate}">${escapeXml(text)}</prosody></voice></speak>`
  );
}

/** One call to the Azure Speech REST API; returns MP3 bytes. */
export async function synthesize(text: string, cfg: AzureConfig, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  const response = await fetchImpl(`https://${cfg.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': cfg.key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'buddy-voice',
    },
    body: buildSsml(text, cfg.voice, cfg.rate),
  });
  if (!response.ok) throw new Error(`Azure TTS ${response.status}: ${await response.text()}`);
  return new Uint8Array(await response.arrayBuffer());
}
