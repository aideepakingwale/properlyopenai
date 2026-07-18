import {
  extractWords,
  expectedPhonemes,
  wordToPhonemes,
  jaccardSimilarity,
} from '../../../shared/phonicsEngine.js';
import { config } from '../config.js';

/**
 * Compare recognized speech against expected reading text using Jaccard on
 * word sets and phoneme sets.
 */
export function validateReading(expectedText, recognizedText) {
  const expectedWords = extractWords(expectedText);
  const recognizedWords = extractWords(recognizedText);
  const expectedPh = expectedPhonemes(expectedText);
  const recognizedPh = recognizedWords.flatMap((w) => wordToPhonemes(w));

  const jaccardWords = jaccardSimilarity(expectedWords, recognizedWords);
  const jaccardPhonemes = jaccardSimilarity(expectedPh, recognizedPh);
  const combined = jaccardWords * 0.6 + jaccardPhonemes * 0.4;
  const threshold = config.jaccardThreshold;
  const passed = combined >= threshold;

  return {
    jaccardWords,
    jaccardPhonemes,
    combined,
    threshold,
    passed,
    expectedWords,
    recognizedWords,
  };
}
