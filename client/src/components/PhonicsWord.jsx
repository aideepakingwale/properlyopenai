import { useMemo, useState } from 'react';
import { analyseWord } from '../phonics/phonicsAnalyser.js';
import { usePhonemePlayer } from '../hooks/usePhonemePlayer.js';

/**
 * Interactive word — tap a grapheme for its cached pure phoneme,
 * or tap the word to sound out all phonemes then blend.
 */
export default function PhonicsWord({
  word,
  phase = 2,
  player: externalPlayer = null,
  showIpa = true,
  className = '',
}) {
  const localPlayer = usePhonemePlayer({ autoload: !externalPlayer });
  const player = externalPlayer || localPlayer;
  const analysis = useMemo(() => analyseWord(word, phase), [word, phase]);
  const [activeTile, setActiveTile] = useState(-1);

  const hearTile = async (tile) => {
    setActiveTile(tile.index);
    await player.play(tile.ipa);
    setActiveTile(-1);
  };

  const hearWord = async () => {
    const ipas = analysis.tiles.map((t) => t.ipa);
    await player.playSequence(ipas);
    // Optional: browser can say the blended word — kept silent for pure phonics mode
  };

  return (
    <span className={`phonics-word ${className}`} data-word={analysis.word}>
      <button type="button" className="phonics-word-btn" onClick={hearWord} title="Sound out word">
        {analysis.tiles.map((tile) => (
          <span
            key={`${tile.grapheme}-${tile.index}`}
            role="button"
            tabIndex={0}
            className={`grapheme grapheme-clickable ${
              activeTile === tile.index || player.playingIndex === tile.index ? 'grapheme-active' : ''
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
          {analysis.phonemes.map((p) => `/${p}/`).join('')}
        </span>
      )}
    </span>
  );
}
