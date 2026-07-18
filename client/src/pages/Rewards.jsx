import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAppStore } from '../store';
import MrsOwl from '../components/MrsOwl';

export default function Rewards() {
  const child = useAppStore((s) => s.child);
  const lastRewards = useAppStore((s) => s.lastRewards);
  const setChild = useAppStore((s) => s.setChild);
  const [rewards, setRewards] = useState([]);

  useEffect(() => {
    if (!child?.id) return;
    api.getRewards(child.id).then(setRewards);
    api.getChild(child.id).then(setChild);
  }, [child?.id, setChild]);

  if (!child) {
    return (
      <p>
        <Link to="/">Create a profile</Link>
      </p>
    );
  }

  const fresh = lastRewards?.rewards || [];

  return (
    <section className="rewards">
      <h1>Acorns & trophies</h1>
      <MrsOwl
        message={
          fresh.length
            ? `Brilliant work, ${child.name}! You earned ${lastRewards.acornGain || ''} acorns.`
            : `You have ${child.acorns} acorns and a ${child.streak}-day streak. Keep reading!`
        }
      />

      <div className="reward-summary">
        <div>
          <strong>{child.acorns}</strong>
          <span>Acorns</span>
        </div>
        <div>
          <strong>{child.streak}</strong>
          <span>Day streak</span>
        </div>
      </div>

      <h2>Trophy shelf</h2>
      <ul className="trophy-list">
        {rewards
          .filter((r) => r.type.startsWith('trophy') || r.type === 'streak')
          .map((r) => (
            <li key={r.id}>
              <span className="trophy-badge" />
              <div>
                <strong>{r.label}</strong>
                <small>{r.earnedAt?.slice(0, 10)}</small>
              </div>
            </li>
          ))}
        {!rewards.length && <li>Complete a story to earn your first trophy.</li>}
      </ul>

      <Link className="btn primary" to="/home">
        Read another story
      </Link>
    </section>
  );
}
