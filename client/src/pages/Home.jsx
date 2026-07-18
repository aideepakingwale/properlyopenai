import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAppStore } from '../store';
import MrsOwl from '../components/MrsOwl';

export default function Home() {
  const navigate = useNavigate();
  const child = useAppStore((s) => s.child);
  const story = useAppStore((s) => s.story);
  const session = useAppStore((s) => s.session);
  const setStory = useAppStore((s) => s.setStory);
  const setSession = useAppStore((s) => s.setSession);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [owl, setOwl] = useState(
    `Welcome back, ${child?.name || 'reader'}! Choose a story or practice sentences to read aloud.`,
  );

  if (!child) {
    return (
      <p>
        No profile yet. <Link to="/">Start onboarding</Link>
      </p>
    );
  }

  const startWithStory = async (nextStory, label) => {
    setBusy(label);
    setError('');
    try {
      setStory(nextStory);
      const nextSession = await api.startSession({ childId: child.id, storyId: nextStory.id });
      setSession(nextSession);
      try {
        const coach = await api.coach({
          childId: child.id,
          context: `Starting "${nextStory.title}"`,
          speak: true,
        });
        setOwl(coach.message);
        if (coach.audio?.url) {
          new Audio(coach.audio.url).play().catch(() => {});
        }
      } catch {
        setOwl(`Let's read: ${nextStory.title}`);
      }
      navigate('/read');
    } catch (err) {
      setError(err.message || 'Could not start session');
      throw err;
    } finally {
      setBusy('');
    }
  };

  const beginReading = async () => {
    setBusy('story');
    setError('');
    try {
      const next = await api.generateStory({
        childId: child.id,
        phase: child.phase,
        interests: child.interests,
        theme: child.interests?.[0],
      });
      await startWithStory(next, 'story');
    } catch (err) {
      setError(err.message || 'Could not start session');
      setBusy('');
    }
  };

  const beginPractice = async () => {
    setBusy('practice');
    setError('');
    try {
      const pack = await api.createPracticePack({
        childId: child.id,
        phase: child.phase,
        theme: 'practice',
      });
      setOwl(
        `Here are ${pack.sentences?.length || 6} Phase ${child.phase} sentences. Pick one, listen, then read it aloud.`,
      );
      await startWithStory(
        { ...pack, kind: 'practice' },
        'practice',
      );
    } catch (err) {
      setError(err.message || 'Could not start practice');
      setBusy('');
    }
  };

  const continueReading = () => {
    if (story && session) navigate('/read');
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
        <button
          className="btn primary lg"
          onClick={beginPractice}
          disabled={Boolean(busy)}
        >
          {busy === 'practice' ? 'Loading sentences…' : 'Practice sentences'}
        </button>
        <button
          className="btn secondary lg"
          onClick={beginReading}
          disabled={Boolean(busy)}
        >
          {busy === 'story' ? 'Writing your story…' : 'Read a new story'}
        </button>
        {story && session && (
          <button className="btn ghost lg" onClick={continueReading} disabled={Boolean(busy)}>
            Continue: {story.title}
          </button>
        )}
        <p className="home-hint">
          <strong>Practice sentences</strong> gives short phase-safe lines to hear, read aloud, and
          score. Use a full story when you want a longer page.
        </p>
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
