import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAppStore } from '../store';

export default function Progress() {
  const child = useAppStore((s) => s.child);
  const setChild = useAppStore((s) => s.setChild);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!child?.id) return;
    api.getProgress(child.id).then((d) => {
      setData(d);
      if (d.child) setChild(d.child);
    });
  }, [child?.id, setChild]);

  if (!child) {
    return (
      <p>
        <Link to="/">Create a profile</Link>
      </p>
    );
  }

  const stats = data?.stats;

  return (
    <section className="progress">
      <h1>Progress</h1>
      <p>Aligned with DfE Letters and Sounds phases</p>

      <div className="phase-track">
        {[2, 3, 4, 5].map((p) => (
          <div key={p} className={`phase-step ${child.phase >= p ? 'done' : ''} ${child.phase === p ? 'current' : ''}`}>
            <strong>Phase {p}</strong>
            <span>{child.phase === p ? 'Current' : child.phase > p ? 'Explored' : 'Ahead'}</span>
          </div>
        ))}
      </div>

      <ul className="stat-list">
        <li>Completed sessions: {stats?.completedSessions ?? 0}</li>
        <li>Average match score: {((stats?.averageJaccard || 0) * 100).toFixed(0)}%</li>
        <li>Acorns: {child.acorns}</li>
        <li>Streak: {child.streak} day(s)</li>
      </ul>

      <h2>Recent sessions</h2>
      <ul className="session-list">
        {(data?.sessions || []).slice(0, 8).map((s) => (
          <li key={s.id}>
            <span>{s.status}</span>
            <span>{s.startedAt?.slice(0, 16)?.replace('T', ' ')}</span>
            <span>
              {s.jaccardScore != null ? `${(s.jaccardScore * 100).toFixed(0)}%` : '—'}
            </span>
          </li>
        ))}
        {!data?.sessions?.length && <li>No sessions yet — start a story from Home.</li>}
      </ul>
    </section>
  );
}
