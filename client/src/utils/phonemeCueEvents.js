export const PHONEME_CUE_EVENT = 'properly:phoneme-cue';

export function showMouthCue({ ipa, grapheme = '', source = 'phoneme', durationMs = 2600 } = {}) {
  if (typeof window === 'undefined' || !ipa) return;
  window.dispatchEvent(
    new CustomEvent(PHONEME_CUE_EVENT, {
      detail: {
        ipa,
        grapheme,
        source,
        durationMs,
      },
    }),
  );
}
