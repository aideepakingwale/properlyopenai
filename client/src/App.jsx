import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Home from './pages/Home.jsx';
import Reading from './pages/Reading.jsx';
import PhonicsGuide from './pages/PhonicsGuide.jsx';
import Progress from './pages/Progress.jsx';
import Rewards from './pages/Rewards.jsx';
import { useAppStore } from './store';

function Guard({ children }) {
  const child = useAppStore((s) => s.child);
  if (!child) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Onboarding />} />
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
