import { Link, NavLink } from 'react-router-dom';
import { useAppStore } from '../store';

export default function Layout({ children }) {
  const child = useAppStore((s) => s.child);

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
      <main className="main">{children}</main>
    </div>
  );
}
