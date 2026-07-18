import { highlightText } from '@shared/phonicsEngine.js';

/**
 * Interactive story text — click a coloured letter (phoneme/grapheme),
 * a word, or rely on parent sentence/story controls.
 */
export default function GraphemeText({
  text,
  phase = 2,
  highlight = null,
  activeWordIndex = -1,
  activeTileIndex = -1,
  activeSentenceWordIndexes = null,
  onPhonemeClick,
  onWordClick,
  interactive = true,
}) {
  const parts = highlight || highlightText(text || '', phase);
  let wordIndex = -1;
  const sentenceSet = activeSentenceWordIndexes
    ? new Set(activeSentenceWordIndexes)
    : null;

  return (
    <p className={`grapheme-text ${interactive ? 'interactive' : ''}`} aria-label="Story text — tap a letter or word to hear Mrs Owl">
      {parts.map((part, i) => {
        if (part.type === 'sep') {
          return <span key={`s-${i}`}>{part.value}</span>;
        }
        wordIndex += 1;
        const idx = wordIndex;
        const wordActive = idx === activeWordIndex;
        const inSentence = sentenceSet ? sentenceSet.has(idx) : false;
        const tiles = part.tiles || [];

        return (
          <span
            key={`w-${i}`}
            className={[
              'word',
              wordActive ? 'word-active' : '',
              inSentence && !wordActive ? 'word-in-sentence' : '',
              part.allowed ? '' : 'word-warn',
              interactive ? 'word-clickable' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            title={`${part.value} — ${(part.phonemes || []).map((p) => `/${p}/`).join(' ')}. Click word to hear.`}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={(e) => {
              if (!interactive || !onWordClick) return;
              // Only fire word click if the event wasn't on a grapheme (grapheme stops propagation)
              if (e.target.closest?.('.grapheme')) return;
              onWordClick({
                word: part.value,
                wordIndex: idx,
                tiles,
                phonemes: part.phonemes || [],
              });
            }}
            onKeyDown={(e) => {
              if (!interactive || !onWordClick) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onWordClick({
                  word: part.value,
                  wordIndex: idx,
                  tiles,
                  phonemes: part.phonemes || [],
                });
              }
            }}
          >
            {tiles.map((tile, ti) =>
              tile.grapheme ? (
                <span
                  key={ti}
                  className={[
                    'grapheme',
                    wordActive && ti === activeTileIndex ? 'grapheme-active' : '',
                    interactive ? 'grapheme-clickable' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ backgroundColor: tile.color }}
                  data-ipa={tile.ipa}
                  title={`/${tile.ipa}/ — click to hear this sound`}
                  role={interactive ? 'button' : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  onClick={(e) => {
                    if (!interactive || !onPhonemeClick) return;
                    e.stopPropagation();
                    onPhonemeClick({
                      word: part.value,
                      wordIndex: idx,
                      tileIndex: ti,
                      grapheme: tile.grapheme,
                      ipa: tile.ipa,
                      color: tile.color,
                    });
                  }}
                  onKeyDown={(e) => {
                    if (!interactive || !onPhonemeClick) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onPhonemeClick({
                        word: part.value,
                        wordIndex: idx,
                        tileIndex: ti,
                        grapheme: tile.grapheme,
                        ipa: tile.ipa,
                        color: tile.color,
                      });
                    }
                  }}
                >
                  {tile.grapheme}
                </span>
              ) : null,
            )}
            {tiles.length === 0 && part.value}
          </span>
        );
      })}
    </p>
  );
}
