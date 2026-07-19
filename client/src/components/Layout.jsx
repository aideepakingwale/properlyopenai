import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '../store';
import MouthCuePopup from './MouthCuePopup.jsx';

const PRODUCT_VERSION = '1.0.0';
const COPYRIGHT_OWNER = 'Deepak Ingwale';
const COPYRIGHT_WEBSITE = 'https://www.deepakingwale.com';

export default function Layout({ children }) {
  const child = useAppStore((s) => s.child);
  const { pathname } = useLocation();
  const isLanding = pathname === '/' || pathname === '/landing';
  const mainClass = pathname === '/read' ? 'main main-reading' : isLanding ? 'main main-landing' : 'main';
  const currentYear = new Date().getFullYear();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <img
            className="brand-mark"
            src="/images/properly-app-icon-192.png"
            alt=""
            width="36"
            height="36"
            aria-hidden="true"
          />
          <span className="brand-name">Properly</span>
        </Link>
        <nav>
          {!child && (
            <>
              <NavLink to="/">Features</NavLink>
              <NavLink to="/start">Start</NavLink>
            </>
          )}
          {child && (
            <>
              <NavLink to="/">Features</NavLink>
              <NavLink to="/home">Home</NavLink>
              <NavLink to="/guide">Phonics</NavLink>
              <NavLink to="/progress">Progress</NavLink>
              <NavLink to="/rewards">Rewards</NavLink>
            </>
          )}
        </nav>
        {child && (
          <div className="top-stats">
            {child.avatarUrl && (
              <img
                className="top-avatar"
                src={child.avatarUrl}
                alt={`${child.name}'s avatar`}
                width="34"
                height="34"
              />
            )}
            <span title="Acorns">{child.acorns ?? 0} acorns</span>
            <span title="Streak">{child.streak ?? 0} day streak</span>
          </div>
        )}
      </header>
      <main className={mainClass}>{children}</main>
      <MouthCuePopup />
      <footer className="app-footer">
        <span>Properly v{PRODUCT_VERSION}</span>
        <span aria-hidden="true">·</span>
        <span>
          (C) {currentYear}{' '}
          <a href={COPYRIGHT_WEBSITE} target="_blank" rel="noreferrer">
            {COPYRIGHT_OWNER}
          </a>
        </span>
      </footer>
    </div>
  );
}
