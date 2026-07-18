import { useCallback, useEffect, useRef, useState } from 'react';
import {
  preloadAllPhonemes,
  playCachedPhoneme,
  playCachedSequence,
  stopPhonemeAudio,
  isPhonemeCacheReady,
  getCachedPhonemeCount,
} from '../audio/phonemeCache.js';
import { ALL_IPA, getPhonemeCue } from '@shared/phonicsEngine.js';

/**
 * usePhonemePlayer — plays preloaded real British English phoneme recordings
 * for all 44 IPA symbols. Used by PhonicsLearn, PhonicsWord, and coaches.
 */
export function usePhonemePlayer({ autoload = true } = {}) {
  const [ready, setReady] = useState(isPhonemeCacheReady());
  const [loading, setLoading] = useState(false);
  const [playingIpa, setPlayingIpa] = useState(null);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [cachedCount, setCachedCount] = useState(getCachedPhonemeCount());
  const cancelled = useRef(false);

  const preload = useCallback(async () => {
    setLoading(true);
    try {
      await preloadAllPhonemes();
      setReady(isPhonemeCacheReady());
      setCachedCount(getCachedPhonemeCount());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoload) return undefined;
    let alive = true;
    preload().then(() => {
      if (!alive) return;
    });
    return () => {
      alive = false;
    };
  }, [autoload, preload]);

  const stop = useCallback(() => {
    cancelled.current = true;
    stopPhonemeAudio();
    setPlayingIpa(null);
    setPlayingIndex(-1);
  }, []);

  useEffect(() => () => stop(), [stop]);

  /**
   * Play one pure phoneme from cache (not letter-name speech).
   * @param {string} ipa
   */
  const play = useCallback(
    async (ipa) => {
      cancelled.current = false;
      if (!ready) await preload();
      setPlayingIpa(ipa);
      setPlayingIndex(-1);
      try {
        await playCachedPhoneme(ipa);
      } finally {
        if (!cancelled.current) {
          setPlayingIpa(null);
        }
      }
      return getPhonemeCue(ipa);
    },
    [ready, preload],
  );

  /**
   * Sound out a sequence of IPA phonemes from cache.
   * @param {string[]} ipas
   */
  const playSequence = useCallback(
    async (ipas, { gapMs = 100 } = {}) => {
      cancelled.current = false;
      if (!ready) await preload();
      try {
        await playCachedSequence(ipas, {
          gapMs,
          onStep: (i, ipa) => {
            if (cancelled.current) return;
            setPlayingIndex(i);
            setPlayingIpa(ipa);
          },
        });
      } finally {
        if (!cancelled.current) {
          setPlayingIpa(null);
          setPlayingIndex(-1);
        }
      }
    },
    [ready, preload],
  );

  /**
   * Play blend components for a diphthong/affricate, then the full phoneme.
   * @param {string} ipa
   */
  const playWithBlend = useCallback(
    async (ipa) => {
      const meta = getPhonemeCue(ipa);
      const blend = meta.blend || [ipa];
      if (blend.length > 1) {
        await playSequence(blend, { gapMs: 80 });
        if (cancelled.current) return meta;
      }
      await play(ipa);
      return meta;
    },
    [play, playSequence],
  );

  return {
    ready,
    loading,
    cachedCount,
    total: ALL_IPA.length,
    playingIpa,
    playingIndex,
    preload,
    play,
    playSequence,
    playWithBlend,
    stop,
  };
}
