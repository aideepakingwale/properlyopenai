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
  const game = data?.gamification;
  const levelProgress = Math.round((game?.level?.progress || 0) * 100);
  const averageScore = Math.round((stats?.averageJaccard || 0) * 100);
  const bestScore = Math.round((stats?.bestScore || 0) * 100);

  return (
    <section className="progress">
      <div className="game-dashboard">
        <div className="game-hero-panel">
          <div className="game-hero-copy">
            <p className="eyebrow">Mission control</p>
            <h1>{child.name}'s reading quest</h1>
            <p className="progress-lede">
              Complete missions, collect acorns, unlock badges, and grow through each phonics phase.
            </p>
          </div>
          <div className="mascot-command">
            <img src="/images/mrs-owl-realistic.png" alt="" width="128" height="128" />
            <div>
              <strong>Mrs Owl says</strong>
              <p>{game?.dailyQuest?.complete ? 'Daily mission complete. Nice focus.' : 'One short read aloud will finish today’s mission.'}</p>
            </div>
          </div>
        </div>

        <div className="game-status-strip">
          <div className="level-card game-level-card">
            <div className="level-ring" style={{ '--level-progress': `${levelProgress}%` }}>
              <span>{game?.level?.level || 1}</span>
            </div>
            <div>
              <strong>{game?.level?.name || 'Acorn Starter'}</strong>
              <span>{child.acorns} / {game?.level?.nextLevelAt || 25} acorns</span>
            </div>
          </div>
          <Metric label="Stories cleared" value={stats?.completedSessions ?? 0} />
          <Metric label="Best voice score" value={`${bestScore}%`} />
          <Metric label="Practice streak" value={`${child.streak} day`} />
        </div>

        <div className="game-board">
          <div className="mission-panel">
            <div className="panel-title-row">
              <div>
                <p className="eyebrow">Today</p>
                <h2>Mission deck</h2>
              </div>
              <Link className="btn secondary" to="/home">
                Start mission
              </Link>
            </div>
            <div className="quest-grid">
              <QuestCard quest={game?.dailyQuest} tone="sun" />
              <QuestCard quest={game?.phaseQuest} tone="mint" />
              <div className="quest-card sky">
                <span className="quest-icon">PB</span>
                <div>
                  <strong>Power score</strong>
                  <p>{bestScore}% best read aloud</p>
                  <div className="quest-meter" aria-hidden="true">
                    <span style={{ width: `${bestScore}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <h2>Phase world map</h2>
            <div className="phase-track phase-track-game">
              {[2, 3, 4, 5].map((p) => (
                <div
                  key={p}
                  className={`phase-step world-node ${child.phase >= p ? 'done' : ''} ${child.phase === p ? 'current' : ''}`}
                >
                  <span className="world-icon">{p}</span>
                  <strong>Phase {p}</strong>
                  <span>{child.phase === p ? 'Current world' : child.phase > p ? 'Explored' : 'Locked soon'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="side-panel">
            <p className="eyebrow">Skill power</p>
            <h2>Reading stats</h2>
            <div className="mini-stat-list">
              <Metric label="Average match" value={`${averageScore}%`} />
              <Metric label="Today" value={`${stats?.sessionsToday ?? 0} read`} />
            </div>
            <div className="homework-card">
              <strong>Homework boost</strong>
              <p>Finish one mission after school to keep the streak alive.</p>
              <Link className="btn primary" to="/home">
                Practise now
              </Link>
            </div>
          </div>
        </div>

        <div className="vault-panel">
          <div className="panel-title-row">
            <div>
              <p className="eyebrow">Unlocks</p>
              <h2>Badge vault</h2>
            </div>
          </div>
          <div className="badge-grid">
            {(game?.badges || []).map((badge) => (
              <div key={badge.type} className={`badge-card ${badge.earned ? 'earned' : ''}`}>
                <span className={`badge-symbol ${badge.icon}`}>{badgeLabel(badge.icon)}</span>
                <div>
                  <strong>{badge.label}</strong>
                  <p>{badge.hint}</p>
                  <div className="badge-meter" aria-hidden="true">
                    <span style={{ width: `${Math.round((badge.progress || 0) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="history-panel">
          <h2>Recent missions</h2>
          <ul className="session-list mission-list">
            {(data?.sessions || []).slice(0, 8).map((s) => (
              <li key={s.id}>
                <span>{s.story?.title || 'Story practice'}</span>
                <span>{formatDate(s.endedAt || s.startedAt)}</span>
                <span>{s.jaccardScore != null ? `${(s.jaccardScore * 100).toFixed(0)}%` : '-'}</span>
              </li>
            ))}
            {!data?.sessions?.length && <li>No missions yet — start a story from Home.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}

function QuestCard({ quest, tone }) {
  const current = quest?.current || 0;
  const target = quest?.target || 1;
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <div className={`quest-card ${tone} ${quest?.complete ? 'complete' : ''}`}>
      <span className="quest-icon">{quest?.complete ? 'OK' : `${current}/${target}`}</span>
      <div>
        <strong>{quest?.title || 'Read one story today'}</strong>
        <p>{quest?.complete ? 'Complete' : `${target - current} step to go`} · Reward: {quest?.reward}</p>
        <div className="quest-meter" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function badgeLabel(icon) {
  const labels = {
    star: 'ST',
    trail: 'TR',
    voice: 'VO',
    phase: 'PH',
    acorn: 'AC',
  };
  return labels[icon] || 'BD';
}

function formatDate(value) {
  if (!value) return 'Not finished';
  return String(value).slice(0, 16).replace('T', ' ');
}
