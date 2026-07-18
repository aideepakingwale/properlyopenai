/**
 * phonicsAnalyser — word / text analysis using phonicsEngine as SoT.
 */

import {
  PHONEMES,
  tokenizeWord,
  wordToPhonemes,
  highlightText,
  graphemeToIpa,
  getPhonemeCue,
  isWordAllowed,
  extractWords,
} from '@shared/phonicsEngine.js';

/**
 * Analyse a single word into grapheme tiles + phoneme metadata + blend components.
 * @param {string} word
 * @param {number} [phase]
 */
export function analyseWord(word, phase = 2) {
  const value = String(word || '').trim();
  const tiles = tokenizeWord(value).filter((t) => t.grapheme);
  const phonemes = wordToPhonemes(value);
  const enriched = tiles.map((t, index) => {
    const meta = getPhonemeCue(t.ipa);
    return {
      index,
      grapheme: t.grapheme,
      ipa: t.ipa,
      color: meta.color || t.color,
      name: meta.name,
      cue: meta.cue,
      tipSpeak: meta.tipSpeak,
      blend: meta.blend || [t.ipa],
      exampleWords: meta.exampleWords || [],
      stretch: meta.stretch,
      phase: meta.phase,
    };
  });

  return {
    word: value,
    allowed: isWordAllowed(value, phase),
    tiles: enriched,
    phonemes,
    /** Flat blend components across the word (for teaching diphthong parts) */
    blendComponents: enriched.flatMap((t) => t.blend),
  };
}

/**
 * Analyse story / sentence text.
 * @param {string} text
 * @param {number} [phase]
 */
export function analyseText(text, phase = 2) {
  const parts = highlightText(text, phase);
  const words = [];
  let wordIndex = -1;
  for (const part of parts) {
    if (part.type !== 'word') continue;
    wordIndex += 1;
    words.push({
      wordIndex,
      ...analyseWord(part.value, phase),
    });
  }
  return {
    text,
    phase,
    words,
    wordCount: words.length,
    uniquePhonemes: [...new Set(words.flatMap((w) => w.phonemes))],
  };
}

/**
 * Resolve a GPC / digraph tile to full phoneme metadata from the engine.
 * @param {string} grapheme
 */
export function analyseGrapheme(grapheme) {
  const ipa = graphemeToIpa(grapheme);
  const meta = getPhonemeCue(ipa);
  return {
    grapheme,
    ipa,
    ...meta,
    phoneme: PHONEMES[ipa] || null,
  };
}

export function getPhonemeMeta(ipa) {
  return getPhonemeCue(ipa);
}
