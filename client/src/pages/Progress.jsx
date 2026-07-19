import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAppStore } from '../store';

const STAGE_MARKS = [
  { left: '11%', top: '22%' },
  { left: '34%', top: '19%' },
  { left: '56%', top: '31%' },
  { left: '47%', top: '59%' },
  { left: '18%', top: '73%' },
  { left: '58%', top: '77%' },
];

const ICON_LABELS = {
  ear: 'Listen',
  bridge: 'Blend',
  word: 'Word',
  voice: 'Line',
  mountain: 'Story',
  library: 'Key',
};

const BADGE_LABELS = {
  ear: 'Sound Explorer',
  bridge: 'Blending Builder',
  word: 'Word Gardener',
  voice: 'Sentence Swimmer',
  mountain: 'Story Climber',
  library: 'Library Champion',
};

const TASK_ICONS = {
  hear_sounds: 'Ear',
  read_words: 'at',
  read_sentence: 'Line',
};

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

  const game = data?.gamification;
  const journey = game?.journey;
  const stats = data?.stats;
  const stages = journey?.stages || fallbackStages(child);
  const activeStage = journey?.activeStage || stages.find((stage) => stage.status === 'current') || stages[0];
  const mission = game?.currentMission;
  const levelProgress = Math.round((game?.level?.progress || 0) * 100);
  const overallProgress = Math.round((journey?.overallProgress || 0) * 100);
  const recentWins = useMemo(() => buildRecentWins(data, child), [data, child]);

  if (!child) {
    return (
      <p>
        <Link to="/">Create a profile</Link>
      </p>
    );
  }

  return (
    <section className="progress quest-page">
      <div className="quest-shell">
        <header className="quest-topbar">
          <div>
            <p className="eyebrow">Adventure map</p>
            <h1>Mrs Owl&apos;s Phonics Quest</h1>
            <p className="progress-lede">
              Follow the path, finish tiny missions, open reward chests, and grow from sounds to
              full story reading.
            </p>
          </div>
          <div className="quest-counters" aria-label="Quest counters">
            <Counter label="Acorns" value={child.acorns || 0} icon="Ac" />
            <Counter label="Day streak" value={child.streak || 0} icon="St" />
            <div className="quest-level-chip">
              <div className="level-ring" style={{ '--level-progress': `${levelProgress}%` }}>
                <span>{game?.level?.level || 1}</span>
              </div>
              <div>
                <strong>{game?.level?.name || 'Acorn Starter'}</strong>
                <span>{levelProgress}% to next level</span>
              </div>
            </div>
          </div>
        </header>

        <div className="quest-main-grid">
          <div className="journey-map-panel">
            <div className="map-sky" aria-hidden="true" />
            <div className="map-path" aria-hidden="true">
              <span className="path-glow" style={{ width: `${Math.max(10, overallProgress)}%` }} />
            </div>

            {stages.map((stage, index) => (
              <StageNode
                key={stage.id}
                stage={stage}
                index={index}
                active={stage.id === activeStage?.id}
              />
            ))}

            <div className="owl-map-marker" style={markerStyle(stages, activeStage)}>
              <img
                src={child.avatarUrl || '/images/mrs-owl-realistic.png'}
                alt={child.avatarUrl ? `${child.name}'s current position` : 'Mrs Owl current position'}
              />
              <span>Here</span>
            </div>

            <aside className="current-mission-card">
              <div className="mission-ribbon">Current Mission</div>
              <h2>{activeStage?.title || mission?.title || 'Sound Forest'}</h2>
              <p>Complete 3 tasks to earn your reward.</p>

              <div className="mission-task-list">
                {(mission?.tasks || []).map((task) => (
                  <MissionTask key={task.id} task={task} />
                ))}
              </div>

              <div className="reward-preview">
                <span className="reward-medal">{ICON_LABELS[activeStage?.icon] || 'Rw'}</span>
                <div>
                  <strong>Reward</strong>
                  <p>{activeStage?.reward || mission?.reward || 'Forest Badge'}</p>
                </div>
              </div>

              <Link className="btn primary continue-quest-btn" to="/home">
                Continue Quest
              </Link>
            </aside>
          </div>
        </div>

        <div className="quest-lower-grid">
          <section className="badge-shelf">
            <div className="panel-title-row">
              <div>
                <p className="eyebrow">My badges</p>
                <h2>Reward shelf</h2>
              </div>
              <Link className="btn secondary" to="/rewards">
                Open vault
              </Link>
            </div>
            <div className="quest-badge-row">
              {stages.map((stage) => (
                <div key={stage.id} className={`quest-badge ${stage.complete ? 'earned' : ''}`}>
                  <span>{ICON_LABELS[stage.icon] || 'Bd'}</span>
                  <strong>{badgeName(stage)}</strong>
                  <small>{stage.complete ? 'Unlocked' : stage.goal}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="recent-wins-panel">
            <p className="eyebrow">Recent wins</p>
            <h2>Quest log</h2>
            <ul className="quest-log-list">
              {recentWins.map((win) => (
                <li key={win.id}>
                  <span className={`win-token ${win.tone}`}>{win.icon}</span>
                  <div>
                    <strong>{win.title}</strong>
                    <small>{win.detail}</small>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <details className="grownup-summary">
            <summary>Grown-up summary</summary>
            <div className="grownup-grid">
              <Metric label="Stories cleared" value={stats?.completedSessions ?? 0} />
              <Metric label="Best voice score" value={`${Math.round((stats?.bestScore || 0) * 100)}%`} />
              <Metric label="Average match" value={`${Math.round((stats?.averageJaccard || 0) * 100)}%`} />
              <Metric label="Today" value={`${stats?.sessionsToday ?? 0} read`} />
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

function StageNode({ stage, index, active }) {
  const pct = Math.round((stage.progress || 0) * 100);
  const style = STAGE_MARKS[index] || STAGE_MARKS[0];
  return (
    <button
      type="button"
      className={`journey-node ${stage.theme || ''} ${stage.status || ''} ${active ? 'active' : ''}`}
      style={style}
      title={`${stage.title}: ${stage.goal}`}
    >
      <span className={`node-icon ${stage.theme}`} aria-hidden="true" />
      <span className="node-order">{stage.order}</span>
      <strong>{stage.title}</strong>
      <small>
        {stage.complete ? 'Reward open' : `${pct}% done`}
      </small>
      <span className="node-chest" aria-hidden="true" />
    </button>
  );
}

function MissionTask({ task }) {
  const pct = Math.min(100, Math.round(((task.current || 0) / (task.target || 1)) * 100));
  return (
    <div className={`mission-task ${task.complete ? 'complete' : ''}`}>
      <span className="task-check">{TASK_ICONS[task.id] || (task.complete ? 'OK' : `${task.current}${task.suffix || ''}`)}</span>
      <div>
        <strong>{task.label}</strong>
        <div className="quest-meter" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function Counter({ icon, label, value }) {
  return (
    <div className="quest-counter">
      <span>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function badgeName(stage) {
  return BADGE_LABELS[stage.icon] || stage.reward;
}

function Metric({ label, value }) {
  return (
    <div className="metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function markerStyle(stages, activeStage) {
  const index = Math.max(0, stages.findIndex((stage) => stage.id === activeStage?.id));
  const mark = STAGE_MARKS[index] || STAGE_MARKS[0];
  return {
    left: `calc(${mark.left} + 4.5rem)`,
    top: `calc(${mark.top} - 2.5rem)`,
  };
}

function buildRecentWins(data, child) {
  const rewards = data?.rewards || [];
  const sessions = data?.sessions || [];
  const wins = rewards.slice(0, 3).map((reward) => ({
    id: reward.id,
    icon: reward.type === 'acorns' ? 'Ac' : 'Bd',
    tone: reward.type === 'acorns' ? 'acorn' : 'badge',
    title: reward.label,
    detail: reward.earnedAt?.slice(0, 10) || 'Recently earned',
  }));
  sessions.slice(0, Math.max(0, 3 - wins.length)).forEach((session) => {
    wins.push({
      id: session.id,
      icon: 'Rd',
      tone: 'read',
      title: session.story?.title || 'Story practice',
      detail: session.jaccardScore != null
        ? `${Math.round(session.jaccardScore * 100)}% voice match`
        : 'Practice started',
    });
  });
  if (!wins.length) {
    wins.push({
      id: 'empty',
      icon: 'Go',
      tone: 'read',
      title: `Welcome, ${child?.name || 'reader'}`,
      detail: 'Start a story to earn your first quest win.',
    });
  }
  return wins;
}

function fallbackStages(child) {
  return [
    'Sound Forest',
    'Blend Bridge',
    'Word Meadow',
    'Sentence Stream',
    'Story Mountain',
    'Treasure Library',
  ].map((title, index) => ({
    id: title.toLowerCase().replace(/\s+/g, '_'),
    order: index + 1,
    title,
    reward: index === 0 ? 'Sound Explorer Badge' : 'Reward Chest',
    icon: ['ear', 'bridge', 'word', 'voice', 'mountain', 'library'][index],
    theme: ['forest', 'bridge', 'meadow', 'stream', 'mountain', 'library'][index],
    current: 0,
    target: 1,
    progress: 0,
    complete: false,
    status: index === 0 ? 'current' : 'locked',
    summary: `Phase ${child?.phase || 2} quest step`,
    goal: 'Complete practice to unlock.',
  }));
}
