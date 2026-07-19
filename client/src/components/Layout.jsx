import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '../store';

const PRODUCT_VERSION = '1.0.0';
const COPYRIGHT_OWNER = 'Deepak Ingwale';
const COPYRIGHT_WEBSITE = 'https://www.deepakingwale.com';

export default function Layout({ children }) {
  const child = useAppStore((s) => s.child);
  const { pathname } = useLocation();
  const mainClass = pathname === '/read' ? 'main main-reading' : 'main';
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
          {child && (
            <>
              <NavLink to="/home">Home</NavLink>
              <NavLink to="/guide">Phonics</NavLink>
              <NavLink to="/progress">Progress</NavLink>
              <NavLink to="/rewards">Rewards</NavLink>
            </>
          )}
        </nav>
        {child && (
          <div className="top-stats">
            <span title="Acorns">{child.acorns ?? 0} acorns</span>
            <span title="Streak">{child.streak ?? 0} day streak</span>
          </div>
        )}
      </header>
      <main className={mainClass}>{children}</main>
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
