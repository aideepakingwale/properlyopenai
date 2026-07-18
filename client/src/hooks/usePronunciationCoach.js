import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import {
  playCachedPhoneme,
  stopPhonemeAudio,
  preloadAllPhonemes,
} from '../audio/phonemeCache.js';

/**
 * Mrs Owl pronunciation coach.
 * Pure phonemes use Web Audio (real hiss/hum/burst) — never speech synthesis letter names.
 * Tips and full words/sentences may use speech synthesis.
 */
export function usePronunciationCoach() {
  const [speaking, setSpeaking] = useState(false);
  const [message, setMessage] = useState('');
  const [active, setActive] = useState({
    wordIndex: -1,
    tileIndex: -1,
    sentenceIndex: -1,
    mode: null,
  });
  const [lesson, setLesson] = useState(null);
  const timersRef = useRef([]);
  const audioRef = useRef(null);
  const cancelledRef = useRef(false);

  const clearTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  };

  const stop = useCallback(() => {
    cancelledRef.current = true;
    clearTimers();
    stopPhonemeAudio();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setActive({ wordIndex: -1, tileIndex: -1, sentenceIndex: -1, mode: null });
  }, []);

  useEffect(() => () => stop(), [stop]);

  const pickVoice = () => {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    return (
      voices.find((v) => /en-GB/i.test(v.lang) && /female|susan|martha|serena|libby|hazel/i.test(v.name)) ||
      voices.find((v) => /en-GB/i.test(v.lang)) ||
      voices.find((v) => /en/i.test(v.lang)) ||
      null
    );
  };

  /** Speech only for tips / whole words — never for phoneme IPA */
  const playBrowserSpeech = (text, rate = 0.95) =>
    new Promise((resolve) => {
      const cleaned = String(text || '').trim();
      if (!cleaned || !window.speechSynthesis) {
        resolve();
        return;
      }
      // Block lone letters — engines say “ess/tee/ay”
      if (/^[a-z]$/i.test(cleaned)) {
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
      // Ensure voices are loaded
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

  const playAudioUrl = (url) =>
    new Promise((resolve) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });

  const pronounce = useCallback(
    async (target) => {
      stop();
      cancelledRef.current = false;
      setSpeaking(true);

      try {
        const isPhonicsSound = target.type === 'phoneme' || target.type === 'word';
        const guide = await api.pronounce({
          type: target.type,
          value: target.value,
          text: target.text || target.value,
          ipa: target.ipa,
          grapheme: target.grapheme,
          phase: target.phase,
          // No server TTS for phoneme/word — Web Audio handles pure sounds
          speak: target.type === 'sentence' || target.type === 'story',
        });
        if (cancelledRef.current) return;
        setLesson(guide);
        setMessage(guide.message);

        const mode = target.type;
        const baseWordIndex =
          typeof target.wordIndex === 'number'
            ? target.wordIndex
            : target.wordIndexes?.[0] ??
              (target.type === 'sentence' || target.type === 'story' ? 0 : -1);
        const sentenceIndex =
          typeof target.sentenceIndex === 'number' ? target.sentenceIndex : -1;

        if (isPhonicsSound && guide.steps?.length) {
          await preloadAllPhonemes();
          for (const step of guide.steps) {
            if (cancelledRef.current) break;

            if (step.pure && step.ipa) {
              // Pure phonics from preloaded 44-sound cache (phonicsEngine SoT)
              setActive({
                wordIndex: baseWordIndex,
                tileIndex: step.tileIndex ?? 0,
                sentenceIndex,
                mode,
              });
              await playCachedPhoneme(step.ipa);
            } else if (step.kind === 'tip' && step.speak) {
              setActive({
                wordIndex: baseWordIndex,
                tileIndex: step.tileIndex ?? 0,
                sentenceIndex,
                mode,
              });
              await playBrowserSpeech(step.speak, 0.95);
            } else if (step.kind === 'word') {
              setActive({
                wordIndex: baseWordIndex,
                tileIndex: -1,
                sentenceIndex,
                mode,
              });
              await playBrowserSpeech(step.speak || target.value, 0.9);
            }
          }
          if (!cancelledRef.current) {
            setSpeaking(false);
            setActive({ wordIndex: -1, tileIndex: -1, sentenceIndex: -1, mode: null });
          }
          return;
        }

        // Sentence / story: highlight words while speaking the sentence
        const steps = guide.steps || [];
        let t = 0;
        steps.forEach((step) => {
          const id = setTimeout(() => {
            if (cancelledRef.current) return;
            if (step.kind === 'word') {
              const wi =
                typeof step.wordOffset === 'number'
                  ? (target.wordIndexes?.[0] ?? 0) + step.wordOffset
                  : baseWordIndex;
              setActive({ wordIndex: wi, tileIndex: -1, sentenceIndex, mode });
            }
          }, t);
          timersRef.current.push(id);
          t += step.durationMs || 500;
        });
        const doneId = setTimeout(() => {
          if (cancelledRef.current) return;
          setSpeaking(false);
          setActive({ wordIndex: -1, tileIndex: -1, sentenceIndex: -1, mode: null });
        }, t + 80);
        timersRef.current.push(doneId);

        if (guide.audio?.url) {
          await playAudioUrl(guide.audio.url);
        } else {
          await playBrowserSpeech(guide.speakText || target.text || '', 0.92);
        }
      } catch (err) {
        setMessage(err.message || 'Mrs Owl could not say that just now. Try again!');
        setSpeaking(false);
        setActive({ wordIndex: -1, tileIndex: -1, sentenceIndex: -1, mode: null });
      }
    },
    [stop],
  );

  return {
    speaking,
    message,
    active,
    lesson,
    pronounce,
    stop,
  };
}
