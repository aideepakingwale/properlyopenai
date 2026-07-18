import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAppStore } from '../store';
import MrsOwl from '../components/MrsOwl';

const INTERESTS = ['dragons', 'space', 'animals', 'pirates', 'fairy tales', 'dinosaurs', 'sport'];

export default function Onboarding() {
  const navigate = useNavigate();
  const setChild = useAppStore((s) => s.setChild);
  const existing = useAppStore((s) => s.child);
  const [name, setName] = useState('');
  const [phase, setPhase] = useState(2);
  const [picked, setPicked] = useState(['animals']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existing?.id) navigate('/home', { replace: true });
  }, [existing, navigate]);

  const toggle = (item) => {
    setPicked((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const child = await api.createChild({ name, phase, interests: picked });
      setChild(child);
      navigate('/home');
    } catch (err) {
      setError(err.message || 'Could not create profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="hero-onboard">
      <div className="hero-copy">
        <p className="eyebrow">AI phonics for every child</p>
        <h1 className="brand-hero">Properly</h1>
        <p className="lede">
          Personalised Letters and Sounds coaching with Mrs Owl — stories, listening, and warm
          feedback at a fraction of private tutoring.
        </p>
        <MrsOwl message="Tell me your name and what you love. Then we can read together!" />
      </div>

      <form className="onboard-form" onSubmit={submit}>
        <label>
          Child&apos;s name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Amelia"
            required
            maxLength={40}
          />
        </label>

        <label>
          Starting phonics phase
          <select value={phase} onChange={(e) => setPhase(Number(e.target.value))}>
            <option value={2}>Phase 2 — First letters</option>
            <option value={3}>Phase 3 — Digraphs</option>
            <option value={4}>Phase 4 — Blends</option>
            <option value={5}>Phase 5 — Alternatives</option>
          </select>
        </label>

        <fieldset>
          <legend>Favourite story themes</legend>
          <div className="chip-row">
            {INTERESTS.map((item) => (
              <button
                type="button"
                key={item}
                className={picked.includes(item) ? 'chip on' : 'chip'}
                onClick={() => toggle(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit" disabled={loading || !name.trim()}>
          {loading ? 'Setting up…' : 'Start with Mrs Owl'}
        </button>
      </form>
    </section>
  );
}
