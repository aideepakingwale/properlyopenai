import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAppStore } from '../store';

export default function PhonicsGuide() {
  const child = useAppStore((s) => s.child);
  const [phase, setPhase] = useState(child?.phase || 2);
  const [guide, setGuide] = useState(null);
  const [phases, setPhases] = useState([]);

  useEffect(() => {
    api.phases().then(setPhases).catch(() => {});
  }, []);

  useEffect(() => {
    api.phaseGuide(phase).then(setGuide).catch(() => setGuide(null));
  }, [phase]);

  if (!child) {
    return (
      <p>
        <Link to="/">Create a profile</Link> first.
      </p>
    );
  }

  return (
    <section className="guide">
      <h1>Phonics guide</h1>
      <p>DfE Letters and Sounds · interactive grapheme tiles</p>

      <div className="phase-tabs">
        {(phases.length ? phases : [2, 3, 4, 5].map((id) => ({ id, name: `Phase ${id}` }))).map(
          (p) => (
            <button
              key={p.id}
              type="button"
              className={phase === p.id ? 'chip on' : 'chip'}
              onClick={() => setPhase(p.id)}
            >
              {p.name || `Phase ${p.id}`}
            </button>
          ),
        )}
      </div>

      {guide && (
        <>
          <h2>{guide.name}</h2>
          <p>{guide.description}</p>
          <div className="tile-grid">
            {(guide.tiles || []).map((t) => (
              <div key={t.grapheme} className="phone-tile" style={{ borderColor: t.color }}>
                <span className="g" style={{ background: t.color }}>
                  {t.grapheme}
                </span>
                <span className="ipa">/{t.ipa}/</span>
                <span className="name">{t.name}</span>
              </div>
            ))}
          </div>
          {guide.trickyWords?.length > 0 && (
            <>
              <h3>Tricky words</h3>
              <p className="tricky">{guide.trickyWords.join(' · ')}</p>
            </>
          )}
        </>
      )}
    </section>
  );
}
