/**
 * Browser speech for whole words / tips — never use for lone letter names.
 */

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return (
    voices.find((v) => /en-GB/i.test(v.lang) && /female|susan|martha|serena|libby|hazel/i.test(v.name)) ||
    voices.find((v) => /en-GB/i.test(v.lang)) ||
    voices.find((v) => /en/i.test(v.lang)) ||
    null
  );
}

/**
 * @param {string} text
 * @param {number} [rate]
 * @returns {Promise<void>}
 */
export function speakText(text, rate = 0.9) {
  return new Promise((resolve) => {
    const cleaned = String(text || '').trim();
    if (!cleaned || typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }
    // Block lone consonant letter-names — allow word forms a / I
    if (/^[a-z]$/i.test(cleaned) && !/^[ai]$/i.test(cleaned)) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(cleaned);
    u.lang = 'en-GB';
    u.rate = rate;
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();

    if (window.speechSynthesis.getVoices().length === 0) {
      setTimeout(() => {
        const v2 = pickVoice();
        if (v2) u.voice = v2;
        window.speechSynthesis.speak(u);
      }, 150);
    } else {
      window.speechSynthesis.speak(u);
    }
  });
}

export function stopSpeech() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
