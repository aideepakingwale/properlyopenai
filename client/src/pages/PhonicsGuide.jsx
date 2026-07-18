import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store';
import PhonicsLearn from '../components/PhonicsLearn.jsx';

/**
 * Phonics guide page — wraps PhonicsLearn (phase GPCs + optional all-44 bank).
 * Sounds come from the preloaded phoneme cache (phonicsEngine SoT).
 */
export default function PhonicsGuide() {
  const child = useAppStore((s) => s.child);
  const [phase, setPhase] = useState(child?.phase || 2);
  const [mode, setMode] = useState('phase');

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
      <p>
        Every sound is loaded from the <strong>phonicsEngine</strong> bank (all 44 IPA phonemes).
        Tap a GPC or digraph for the <em>pure phonics sound</em> — never the letter name.
      </p>

      <div className="chip-row" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={mode === 'phase' ? 'chip on' : 'chip'}
          onClick={() => setMode('phase')}
        >
          Phase GPCs
        </button>
        <button
          type="button"
          className={mode === 'all44' ? 'chip on' : 'chip'}
          onClick={() => setMode('all44')}
        >
          All 44 phonemes
        </button>
      </div>

      <PhonicsLearn
        phase={phase}
        mode={mode}
        onPhaseChange={setPhase}
      />
    </section>
  );
}
