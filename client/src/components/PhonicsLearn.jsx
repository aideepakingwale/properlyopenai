import { useMemo, useState } from 'react';
import {
  listAllPhonemes,
  getPhaseGuide,
  CONSONANT_IPA,
  VOWEL_IPA,
} from '@shared/phonicsEngine.js';
import { analyseGrapheme } from '../phonics/phonicsAnalyser.js';
import { usePhonemePlayer } from '../hooks/usePhonemePlayer.js';
import MrsOwl from './MrsOwl.jsx';
import PhonicsWord from './PhonicsWord.jsx';

/**
 * PhonicsLearn — browse all 44 IPA phonemes / phase GPCs with preloaded sounds.
 */
export default function PhonicsLearn({
  phase = 2,
  mode = 'phase', // 'phase' | 'all44'
  onPhaseChange,
}) {
  const player = usePhonemePlayer({ autoload: true });
  const [activeIpa, setActiveIpa] = useState(null);
  const [activeGrapheme, setActiveGrapheme] = useState(null);
  const [owl, setOwl] = useState(
    'Tap a sound box. Pure phonics from the cached bank — not letter names.',
  );

  const guide = useMemo(() => getPhaseGuide(phase), [phase]);
  const allPhonemes = useMemo(() => listAllPhonemes(), []);

  const hearPhoneme = async (ipa, grapheme = null) => {
    setActiveIpa(ipa);
    setActiveGrapheme(grapheme);
    const meta = await player.play(ipa);
    setOwl(
      `/${ipa}/ — ${meta?.cue || 'Listen and copy.'}${
        meta?.exampleWords?.length ? ` Examples: ${meta.exampleWords.join(', ')}.` : ''
      }`,
    );
  };

  const hearGpc = async (grapheme) => {
    const analysed = analyseGrapheme(grapheme);
    await hearPhoneme(analysed.ipa, grapheme);
  };

  const hearBlend = async (ipa) => {
    setActiveIpa(ipa);
    const meta = await player.playWithBlend(ipa);
    setOwl(
      meta.blend?.length > 1
        ? `Blend ${meta.blend.map((b) => `/${b}/`).join(' + ')} → /${ipa}/`
        : `/${ipa}/ — ${meta.cue}`,
    );
  };

  const renderTile = (t) => {
    const ipa = t.ipa || t;
    const grapheme = t.grapheme || t.name || ipa;
    const color = t.color;
    const playing =
      player.playingIpa === ipa &&
      (activeGrapheme == null || activeGrapheme === grapheme || !t.grapheme);
    return (
      <button
        key={`${grapheme}-${ipa}`}
        type="button"
        className={`phone-tile clickable-tile ${playing ? 'tile-playing' : ''}`}
        style={{ borderColor: color }}
        onClick={() => (t.grapheme ? hearGpc(t.grapheme) : hearPhoneme(ipa))}
        onDoubleClick={() => hearBlend(ipa)}
        title={`Play cached /${ipa}/ — double-tap for blend parts`}
      >
        <span className="g" style={{ background: color }}>
          {grapheme}
        </span>
        <span className="ipa">/{ipa}/</span>
        <span className="name">{t.kindLabel || t.name || ''}</span>
      </button>
    );
  };

  return (
    <div className="phonics-learn">
      <div className="cache-status" aria-live="polite">
        {player.loading && <span>Loading phoneme bank…</span>}
        {player.ready && (
          <span>
            Real phoneme bank ready — {player.cachedCount}/{player.total} British English
            recordings cached
          </span>
        )}
        {!player.ready && !player.loading && (
          <button type="button" className="btn ghost" onClick={player.preload}>
            Load real phoneme sounds
          </button>
        )}
      </div>

      <MrsOwl message={owl} speaking={Boolean(player.playingIpa)} />

      {mode === 'phase' && guide && (
        <>
          <div className="phase-tabs">
            {[2, 3, 4, 5].map((p) => (
              <button
                key={p}
                type="button"
                className={phase === p ? 'chip on' : 'chip'}
                onClick={() => onPhaseChange?.(p)}
              >
                Phase {p}
              </button>
            ))}
          </div>
          <h2>{guide.name}</h2>
          <p>{guide.description}</p>

          {guide.singles?.length > 0 && (
            <>
              <h3>Single letter GPCs</h3>
              <div className="tile-grid">{guide.singles.map(renderTile)}</div>
            </>
          )}
          {guide.digraphs?.length > 0 && (
            <>
              <h3>Digraphs</h3>
              <div className="tile-grid">{guide.digraphs.map(renderTile)}</div>
            </>
          )}
          {guide.trigraphs?.length > 0 && (
            <>
              <h3>Trigraphs &amp; split digraphs</h3>
              <div className="tile-grid">{guide.trigraphs.map(renderTile)}</div>
            </>
          )}

          {guide.trickyWords?.length > 0 && (
            <>
              <h3>Tricky words</h3>
              <div className="chip-row phonics-word-row">
                {guide.trickyWords.map((w) => (
                  <PhonicsWord key={w} word={w} phase={phase} player={player} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {mode === 'all44' && (
        <>
          <h2>All 44 IPA phonemes</h2>
          <p>Preloaded from phonicsEngine — tap to hear the pure sound.</p>
          <h3>Consonants ({CONSONANT_IPA.length})</h3>
          <div className="tile-grid">
            {allPhonemes.filter((p) => CONSONANT_IPA.includes(p.ipa)).map(renderTile)}
          </div>
          <h3>Vowels ({VOWEL_IPA.length})</h3>
          <div className="tile-grid">
            {allPhonemes.filter((p) => VOWEL_IPA.includes(p.ipa)).map(renderTile)}
          </div>
        </>
      )}

      {player.playingIpa && (
        <button type="button" className="btn ghost" onClick={player.stop} style={{ marginTop: '1rem' }}>
          Stop
        </button>
      )}
    </div>
  );
}
