import { highlightText } from '@shared/phonicsEngine.js';

export default function GraphemeText({ text, phase = 2, highlight = null, activeWordIndex = -1 }) {
  const parts = highlight || highlightText(text || '', phase);
  let wordIndex = -1;

  return (
    <p className="grapheme-text" aria-label="Story text with grapheme colours">
      {parts.map((part, i) => {
        if (part.type === 'sep') {
          return <span key={`s-${i}`}>{part.value}</span>;
        }
        wordIndex += 1;
        const idx = wordIndex;
        const active = idx === activeWordIndex;
        return (
          <span
            key={`w-${i}`}
            className={`word ${active ? 'word-active' : ''} ${part.allowed ? '' : 'word-warn'}`}
            title={(part.phonemes || []).join(' ')}
          >
            {(part.tiles || []).map((tile, ti) =>
              tile.grapheme ? (
                <span
                  key={ti}
                  className="grapheme"
                  style={{ backgroundColor: tile.color }}
                  data-ipa={tile.ipa}
                >
                  {tile.grapheme}
                </span>
              ) : null,
            )}
            {(!part.tiles || part.tiles.length === 0) && part.value}
          </span>
        );
      })}
    </p>
  );
}
