import { useCallback, useEffect, useRef, useState } from 'react';
import { buildPronunciationLesson } from '@shared/phonicsEngine.js';
import {
  playCachedPhoneme,
  stopPhonemeAudio,
  preloadAllPhonemes,
  isPhonemeCacheReady,
} from '../audio/phonemeCache.js';
import { showMouthCue } from '../utils/phonemeCueEvents.js';

/**
 * Mrs Owl pronunciation coach.
 * Sentence/story/word scaffolding is built on the client so phoneme steps
 * always use the 44 cached recordings — never letter-name TTS.
 */
export function usePronunciationCoach() {
  const [speaking, setSpeaking] = useState(false);
  const [message, setMessage] = useState('');
  const [active, setActive] = useState({
    wordIndex: -1,
    tileIndex: -1,
    sentenceIndex: -1,
    mode: null,
    ipa: null,
    grapheme: '',
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
    setActive({ wordIndex: -1, tileIndex: -1, sentenceIndex: -1, mode: null, ipa: null, grapheme: '' });
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

  const playBrowserSpeech = (text, rate = 0.95) =>
    new Promise((resolve) => {
      const cleaned = String(text || '').trim();
      if (!cleaned || !window.speechSynthesis) {
        resolve();
        return;
      }
      // Block lone consonant letter-names (“ess/tee”) — allow word forms a / I
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

  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  const isPhonemeStep = (step) =>
    Boolean(step?.ipa) &&
    (step.pure === true || step.kind === 'tile' || step.kind === 'phoneme');

  const resolveWordIndex = (target, step, baseWordIndex) => {
    if (typeof step.wordOffset === 'number') {
      return (target.wordIndexes?.[0] ?? 0) + step.wordOffset;
    }
    return baseWordIndex;
  };

  const pronounce = useCallback(
    async (target) => {
      stop();
      cancelledRef.current = false;
      setSpeaking(true);

      try {
        const hearMode = target.hearMode || 'phonemes';

        // Build steps locally — guarantees phoneme tiles from the 44-sound bank
        const guide = buildPronunciationLesson({
          type: target.type,
          value: target.value,
          text: target.text || target.value,
          ipa: target.ipa,
          grapheme: target.grapheme,
          phase: target.phase,
          hearMode,
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

        const steps = guide.steps || [];
        const hasCachedPhonemes = steps.some(isPhonemeStep);
        const useScaffold =
          target.type === 'phoneme' ||
          target.type === 'word' ||
          ((target.type === 'sentence' || target.type === 'story') &&
            hearMode !== 'full');

        if (useScaffold && steps.length) {
          if (hasCachedPhonemes || target.type === 'phoneme' || target.type === 'word') {
            await preloadAllPhonemes();
          }

          for (const step of steps) {
            if (cancelledRef.current) break;
            const wi = resolveWordIndex(target, step, baseWordIndex);
            const stepSentenceIndex =
              typeof step.sentenceIndex === 'number' ? step.sentenceIndex : sentenceIndex;

            if (isPhonemeStep(step)) {
              setActive({
                wordIndex: wi,
                tileIndex: step.tileIndex ?? 0,
                sentenceIndex: stepSentenceIndex,
                mode: hearMode,
                ipa: step.ipa,
                grapheme: step.grapheme || '',
              });
              setMessage(`Sound: /${step.ipa}/`);
              showMouthCue({
                ipa: step.ipa,
                grapheme: step.grapheme || '',
                source: target.type || 'coach',
                durationMs: 1800,
              });
              await playCachedPhoneme(step.ipa);
              await pause(90);
              continue;
            }

            if (step.kind === 'tip' && step.speak) {
              setActive({
                wordIndex: wi,
                tileIndex: step.tileIndex ?? 0,
                sentenceIndex: stepSentenceIndex,
                mode: hearMode,
                ipa: step.ipa || null,
                grapheme: step.grapheme || '',
              });
              await playBrowserSpeech(step.speak, 0.95);
              continue;
            }

            if (step.kind === 'word' && step.speak) {
              setActive({
                wordIndex: wi,
                tileIndex: -1,
                sentenceIndex: stepSentenceIndex,
                mode: hearMode,
                ipa: null,
                grapheme: '',
              });
              setMessage(`Word: ${step.speak}`);
              await playBrowserSpeech(step.speak, 0.88);
              await pause(120);
              continue;
            }

            if (step.kind === 'sentence' && step.speak) {
              setActive({
                wordIndex: -1,
                tileIndex: -1,
                sentenceIndex: stepSentenceIndex,
                mode: hearMode,
                ipa: null,
                grapheme: '',
              });
              setMessage(`Sentence: ${step.speak}`);
              await playBrowserSpeech(step.speak, 0.9);
              await pause(160);
            }
          }

          if (!cancelledRef.current) {
            setSpeaking(false);
            setActive({ wordIndex: -1, tileIndex: -1, sentenceIndex: -1, mode: null, ipa: null, grapheme: '' });
            setMessage(guide.message);
          }
          return;
        }

        // Full-page only: one continuous read with word highlights
        let t = 0;
        steps.forEach((step) => {
          const id = setTimeout(() => {
            if (cancelledRef.current) return;
            if (step.kind === 'word') {
              const wi = resolveWordIndex(target, step, baseWordIndex);
              setActive({ wordIndex: wi, tileIndex: -1, sentenceIndex, mode, ipa: null, grapheme: '' });
            }
          }, t);
          timersRef.current.push(id);
          t += step.durationMs || 500;
        });
        const doneId = setTimeout(() => {
          if (cancelledRef.current) return;
          setSpeaking(false);
          setActive({ wordIndex: -1, tileIndex: -1, sentenceIndex: -1, mode: null, ipa: null, grapheme: '' });
        }, t + 80);
        timersRef.current.push(doneId);
        await playBrowserSpeech(guide.speakText || target.text || '', 0.92);
      } catch (err) {
        setMessage(err.message || 'Mrs Owl could not say that just now. Try again!');
        setSpeaking(false);
        setActive({ wordIndex: -1, tileIndex: -1, sentenceIndex: -1, mode: null, ipa: null, grapheme: '' });
      }
    },
    [stop],
  );

  return {
    speaking,
    message,
    active,
    lesson,
    cacheReady: isPhonemeCacheReady(),
    pronounce,
    stop,
  };
}
