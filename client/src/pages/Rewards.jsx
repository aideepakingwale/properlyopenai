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
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!child?.id) return;
    api.getRewards(child.id).then(setRewards);
    api.getProgress(child.id).then(setProgress);
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
  const game = progress?.gamification;
  const trophyRewards = rewards.filter((r) => r.type.startsWith('trophy') || r.type === 'streak');
  const acornRewards = rewards.filter((r) => r.type === 'acorns').slice(0, 5);
  const levelProgress = Math.round((game?.level?.progress || 0) * 100);
  const nextMilestone = game?.currentMission?.nextMilestone;

  return (
    <section className="rewards">
      <div className="reward-dashboard">
        <div className="rewards-hero reward-hero-panel">
          <div>
            <p className="eyebrow">Reward vault</p>
            <h1>Acorns, badges & power-ups</h1>
            <p className="progress-lede">
              Every read aloud adds to the vault. Keep practising to unlock the next badge.
            </p>
          </div>
          <div className="mascot-command reward-mascot">
            <img src="/images/mrs-owl-realistic.png" alt="" width="118" height="118" />
            <div>
              <strong>Vault guide</strong>
              <p>{fresh.length ? 'New rewards are glowing in your shelf.' : 'Your next mission can unlock more acorns.'}</p>
            </div>
          </div>
          <Link className="btn primary" to="/home">
            Start next mission
          </Link>
        </div>

        <div className="reward-board">
          <div className="reward-summary">
            <div>
              <strong>{child.acorns}</strong>
              <span>Acorns</span>
            </div>
            <div>
              <strong>{child.streak}</strong>
              <span>Day streak</span>
            </div>
            <div>
              <strong>{game?.level?.level || 1}</strong>
              <span>{game?.level?.name || 'Reader level'}</span>
            </div>
          </div>

          <div className="level-progress-card vault-level">
            <div>
              <strong>Next reader level</strong>
              <p>{child.acorns} / {game?.level?.nextLevelAt || 25} acorns</p>
            </div>
            <div className="quest-meter" aria-hidden="true">
              <span style={{ width: `${levelProgress}%` }} />
            </div>
          </div>

          {nextMilestone && (
            <div className="level-progress-card vault-level next-vault-unlock">
              <div>
                <strong>Next badge</strong>
                <p>{nextMilestone.remainingText}</p>
              </div>
              <div className="quest-meter" aria-hidden="true">
                <span style={{ width: `${Math.round((nextMilestone.progress || 0) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        {fresh.length > 0 && (
          <div className="vault-panel fresh-panel">
            <p className="eyebrow">New loot</p>
            <h2>Just earned</h2>
            <ul className="fresh-reward-list">
              {fresh.map((r) => (
                <li key={r.id || `${r.type}-${r.label}`}>
                  <span className="trophy-badge" />
                  <strong>{r.label}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="reward-grid-layout">
          <div className="vault-panel badge-shelf-panel">
            <p className="eyebrow">Collection</p>
            <h2>Badge shelf</h2>
            <ul className="trophy-list trophy-grid-list">
              {trophyRewards.map((r) => (
                <li key={r.id}>
                  <span className="trophy-badge" />
                  <div>
                    <strong>{r.label}</strong>
                    <small>{r.earnedAt?.slice(0, 10)}</small>
                  </div>
                </li>
              ))}
              {!trophyRewards.length && <li>Complete a story to earn your first badge.</li>}
            </ul>
          </div>

          <div className="history-panel acorn-log-panel">
            <p className="eyebrow">Recent wins</p>
            <h2>Acorn log</h2>
            <ul className="session-list">
              {acornRewards.map((r) => (
                <li key={r.id}>
                  <span>{r.label}</span>
                  <span>{r.earnedAt?.slice(0, 10)}</span>
                  <span>{Math.round((r.meta?.jaccardScore || 0) * 100)}%</span>
                </li>
              ))}
              {!acornRewards.length && <li>No acorns yet — finish a read aloud to start collecting.</li>}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
