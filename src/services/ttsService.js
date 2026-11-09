'use strict';

/**
 * ttsService.js
 * -----------------------------------------------------------------------
 * Text-to-speech for interview questions, so a question can be read aloud
 * instead of only displayed as text.
 *
 * Wraps `msedge-tts`, which talks to Microsoft Edge's free neural TTS
 * service over a WebSocket (api.msedgeservices.com) — no API key needed.
 *
 * Same reliability contract as the rest of this codebase's AI-backed
 * services: never throws. If synthesis fails for any reason (no network,
 * the host is blocked, the service is down, a bad voice name, etc.) this
 * resolves to `null`, and the caller (resumeController.getQuestionAudio)
 * responds with 204 so the frontend falls back to showing the question as
 * text only. Reading a question aloud is a convenience, never a dependency
 * of the interview-practice flow.
 * -----------------------------------------------------------------------
 */

const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

function getConfig() {
  return {
    voice: process.env.TTS_VOICE?.trim() || 'en-US-GuyNeural',
    timeoutMs: positiveInteger(process.env.TTS_TIMEOUT_MS, 8000),
  };
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Synthesises `text` to an MP3 Buffer using Edge TTS.
 * Returns null (never throws) on any failure — unreachable service,
 * timeout, empty input, etc.
 */
async function generateSpeech(text) {
  const input = (text || '').trim();
  if (!input) return null;

  const { voice, timeoutMs } = getConfig();
  let tts;
  try {
    tts = new MsEdgeTTS({ connectionTimeoutMs: timeoutMs, synthesisTimeoutMs: timeoutMs });
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(input);

    const buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      audioStream.on('data', (chunk) => chunks.push(chunk));
      audioStream.on('end', () => resolve(Buffer.concat(chunks)));
      audioStream.on('error', (err) => reject(err));
    });

    return buffer.length ? buffer : null;
  } catch {
    return null;
  } finally {
    tts?.close();
  }
}

module.exports = { generateSpeech };
