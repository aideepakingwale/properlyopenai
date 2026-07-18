/**
 * Back-compat surface — all playback goes through the preloaded phoneme cache
 * built from phonicsEngine PHONEMES[ipa].audio recipes.
 */
export {
  preloadAllPhonemes,
  playCachedPhoneme as playPhonemeSound,
  playCachedSequence as playPhonemeSequence,
  stopPhonemeAudio,
  isPhonemeCacheReady,
  getCachedPhonemeCount,
} from './phonemeCache.js';
