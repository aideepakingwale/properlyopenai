import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAppStore } from '../store';
import MrsOwl from '../components/MrsOwl';

export default function Home() {
  const navigate = useNavigate();
  const child = useAppStore((s) => s.child);
  const setStory = useAppStore((s) => s.setStory);
  const setSession = useAppStore((s) => s.setSession);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [owl, setOwl] = useState(`Welcome back, ${child?.name || 'reader'}! Ready for a story?`);

  if (!child) {
    return (
      <p>
        No profile yet. <Link to="/">Start onboarding</Link>
      </p>
    );
  }

  const beginReading = async () => {
    setBusy(true);
    setError('');
    try {
      const story = await api.generateStory({
        childId: child.id,
        phase: child.phase,
        interests: child.interests,
        theme: child.interests?.[0],
      });
      setStory(story);
      const session = await api.startSession({ childId: child.id, storyId: story.id });
      setSession(session);
      const coach = await api.coach({
        childId: child.id,
        context: `Starting story "${story.title}"`,
        speak: true,
      });
      setOwl(coach.message);
      if (coach.audio?.url) {
        new Audio(coach.audio.url).play().catch(() => {});
      }
      navigate('/read');
    } catch (err) {
      setError(err.message || 'Could not start session');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="home">
      <div className="home-hero">
        <h1>Hello, {child.name}</h1>
        <p>
          Phase {child.phase} · {child.interests?.join(', ') || 'open themes'}
        </p>
        <MrsOwl message={owl} />
      </div>

      <div className="home-actions">
        <button className="btn primary lg" onClick={beginReading} disabled={busy}>
          {busy ? 'Writing your story…' : 'Read a new story'}
        </button>
        <div className="quick-links">
          <Link to="/guide">Phonics guide</Link>
          <Link to="/progress">See progress</Link>
          <Link to="/rewards">Acorns & trophies</Link>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
}
