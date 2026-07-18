/**
 * Preloaded / cached real phoneme recordings for all 44 IPA symbols.
 * Files live in /phonemes/{slug}.mp3 (see scripts/download-phoneme-audio.mjs).
 * Falls back to a short silence buffer only if a file is missing — never uses
 * the old synthetic “weird tone” generator for playback.
 */

import { ALL_IPA, PHONEMES } from '@shared/phonicsEngine.js';
import { phonemeAudioUrl } from '@shared/phonemeAudioMap.js';

/** @type {Map<string, AudioBuffer>} */
const bufferCache = new Map();
/** @type {AudioContext|null} */
let ctx = null;
/** @type {Promise<void>|null} */
let preloadPromise = null;
let ready = false;
/** @type {AudioBufferSourceNode[]} */
let playingSources = [];

function getAudioContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function silenceBuffer(audioCtx, seconds = 0.15) {
  const frames = Math.max(1, Math.floor(audioCtx.sampleRate * seconds));
  return audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
}

/**
 * Fetch + decode one real phoneme MP3 into an AudioBuffer.
 * @param {string} ipa
 */
async function loadPhonemeBuffer(ipa) {
  const audioCtx = getAudioContext();
  const url = PHONEMES[ipa]?.audioUrl || phonemeAudioUrl(ipa);
  if (!url) return silenceBuffer(audioCtx);

  const res = await fetch(url, { cache: 'default' });
  if (!res.ok) {
    console.warn(`Missing phoneme audio for /${ipa}/ at ${url}`);
    return silenceBuffer(audioCtx);
  }
  const arr = await res.arrayBuffer();
  return audioCtx.decodeAudioData(arr.slice(0));
}

/**
 * Preload and cache AudioBuffers for all 44 phonemes (real MP3 recordings).
 */
export function preloadAllPhonemes() {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    getAudioContext();
    await Promise.all(
      ALL_IPA.map(async (ipa) => {
        if (bufferCache.has(ipa)) return;
        try {
          const buffer = await loadPhonemeBuffer(ipa);
          bufferCache.set(ipa, buffer);
        } catch (err) {
          console.warn('Failed to cache phoneme', ipa, err);
          bufferCache.set(ipa, silenceBuffer(getAudioContext()));
        }
      }),
    );
    ready = bufferCache.size >= ALL_IPA.length;
  })();
  return preloadPromise;
}

export function isPhonemeCacheReady() {
  return ready && bufferCache.size >= ALL_IPA.length;
}

export function getCachedPhonemeCount() {
  return bufferCache.size;
}

export function stopPhonemeAudio() {
  for (const src of playingSources) {
    try {
      src.stop();
      src.disconnect();
    } catch {
      /* ignore */
    }
  }
  playingSources = [];
}

/**
 * Play a cached real phoneme recording.
 * @param {string} ipa
 */
export async function playCachedPhoneme(ipa) {
  await preloadAllPhonemes();
  const audioCtx = getAudioContext();
  stopPhonemeAudio();

  let buffer = bufferCache.get(ipa);
  if (!buffer) {
    buffer = await loadPhonemeBuffer(ipa);
    bufferCache.set(ipa, buffer);
  }

  return new Promise((resolve) => {
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.value = 1;
    src.connect(gain);
    gain.connect(audioCtx.destination);
    playingSources.push(src);
    src.onended = () => {
      playingSources = playingSources.filter((s) => s !== src);
      resolve();
    };
    src.start(0);
  });
}

/**
 * @param {string[]} ipas
 */
export async function playCachedSequence(ipas, { gapMs = 120, onStep } = {}) {
  await preloadAllPhonemes();
  for (let i = 0; i < ipas.length; i += 1) {
    onStep?.(i, ipas[i]);
    await playCachedPhoneme(ipas[i]);
    if (gapMs && i < ipas.length - 1) {
      await new Promise((r) => setTimeout(r, gapMs));
    }
  }
}

export const playPhonemeSound = playCachedPhoneme;
export const playPhonemeSequence = playCachedSequence;
