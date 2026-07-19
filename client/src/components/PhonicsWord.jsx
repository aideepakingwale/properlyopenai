import { useMemo, useState } from 'react';
import { analyseWord } from '../phonics/phonicsAnalyser.js';
import { usePhonemePlayer } from '../hooks/usePhonemePlayer.js';
import { speakText, stopSpeech } from '../audio/speakText.js';

/**
 * Interactive word — tap a grapheme for its phoneme, or hear the word:
 * sound out each phoneme, then speak the blended word.
 *
 * Highlighting is local to this word instance so a shared player’s
 * playingIndex cannot light up tiles on sibling words.
 */
export default function PhonicsWord({
  word,
  phase = 2,
  player: externalPlayer = null,
  showIpa = true,
  className = '',
  /** When true (default for tricky words), show a clear “Hear word” control */
  showWordButton,
}) {
  const localPlayer = usePhonemePlayer({ autoload: !externalPlayer });
  const player = externalPlayer || localPlayer;
  const analysis = useMemo(() => analyseWord(word, phase), [word, phase]);
  const [activeTile, setActiveTile] = useState(-1);
  const [hearingWord, setHearingWord] = useState(false);
  const showBlendButton = showWordButton ?? analysis.tricky;

  const hearTile = async (tile) => {
    stopSpeech();
    setHearingWord(false);
    setActiveTile(tile.index);
    await player.play(tile.ipa, { grapheme: tile.grapheme, source: 'word-tile' });
    setActiveTile(-1);
  };

  /** Sound out phonemes, then pronounce the whole word */
  const hearWord = async () => {
    stopSpeech();
    setHearingWord(true);
    setActiveTile(-1);
    try {
      const ipas = analysis.phonemes.length
        ? analysis.phonemes
        : analysis.tiles.map((t) => t.ipa);
      await player.playSequence(ipas, {
        cueSteps: ipas.map((ipa, i) => ({
          ipa,
          grapheme:
            analysis.tiles[Math.min(i, Math.max(0, analysis.tiles.length - 1))]?.grapheme || '',
          source: 'word-sequence',
        })),
        onStep: (i) => {
          // Map phoneme step onto a visible tile (extras land on last tile)
          const tileIndex = Math.min(i, Math.max(0, analysis.tiles.length - 1));
          setActiveTile(tileIndex);
        },
      });
      setActiveTile(-1);
      await speakText(analysis.speakAs || analysis.word, 0.88);
    } finally {
      setHearingWord(false);
      setActiveTile(-1);
    }
  };

  return (
    <span
      className={`phonics-word ${analysis.tricky ? 'phonics-word-tricky' : ''} ${className}`}
      data-word={analysis.word}
    >
      <button
        type="button"
        className={`phonics-word-btn ${hearingWord ? 'hearing' : ''}`}
        onClick={hearWord}
        title="Sound out phonemes, then hear the word"
      >
        {analysis.tiles.map((tile) => (
          <span
            key={`${tile.grapheme}-${tile.index}`}
            role="button"
            tabIndex={0}
            className={`grapheme grapheme-clickable ${
              activeTile === tile.index ? 'grapheme-active' : ''
            }`}
            style={{ backgroundColor: tile.color }}
            title={`/${tile.ipa}/ — ${tile.cue}`}
            onClick={(e) => {
              e.stopPropagation();
              hearTile(tile);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                hearTile(tile);
              }
            }}
          >
            {tile.grapheme}
          </span>
        ))}
      </button>
      {showIpa && (
        <span className="phonics-word-ipa">
          {analysis.phonemes.map((p) => `/${p}/`).join(' ')}
        </span>
      )}
      {showBlendButton && (
        <button
          type="button"
          className="phonics-word-say"
          onClick={hearWord}
          disabled={hearingWord}
          title="Hear each phoneme, then the whole word"
        >
          {hearingWord ? 'Listening…' : 'Hear word'}
        </button>
      )}
    </span>
  );
}
