import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Home from './pages/Home.jsx';
import Reading from './pages/Reading.jsx';
import PhonicsGuide from './pages/PhonicsGuide.jsx';
import Progress from './pages/Progress.jsx';
import Rewards from './pages/Rewards.jsx';
import { useAppStore } from './store';
import { preloadAllPhonemes } from './audio/phonemeCache.js';

function Guard({ children }) {
  const child = useAppStore((s) => s.child);
  if (!child) return <Navigate to="/start" replace />;
  return children;
}

export default function App() {
  // Warm the 44-phoneme AudioBuffer cache as soon as the app mounts.
  // Actual AudioContext unlock happens on first user gesture / play.
  useEffect(() => {
    const warm = () => {
      preloadAllPhonemes().catch(() => {});
    };
    warm();
    const unlock = () => {
      warm();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/start" element={<Onboarding />} />
        <Route
          path="/home"
          element={
            <Guard>
              <Home />
            </Guard>
          }
        />
        <Route
          path="/read"
          element={
            <Guard>
              <Reading />
            </Guard>
          }
        />
        <Route
          path="/guide"
          element={
            <Guard>
              <PhonicsGuide />
            </Guard>
          }
        />
        <Route
          path="/progress"
          element={
            <Guard>
              <Progress />
            </Guard>
          }
        />
        <Route
          path="/rewards"
          element={
            <Guard>
              <Rewards />
            </Guard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
