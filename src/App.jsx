import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useBoard } from './hooks/useBoard';
import Sidebar         from './components/Sidebar';
import LoginPage       from './pages/LoginPage';
import DispatchPage    from './pages/DispatchPage';
import BoardPage       from './pages/BoardPage';
import DashboardPage   from './pages/DashboardPage';
import LeaderboardPage from './pages/LeaderboardPage';
import DriversPage     from './pages/DriversPage';
import HistoryPage     from './pages/HistoryPage';
import SettingsPage    from './pages/SettingsPage';
import { getClient, signOut } from './lib/supabase';
import './App.css';

export default function App() {
  return <AuthGate />;
}

// ── Auth gate — shows login page until user is signed in ──────────
function AuthGate() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    const client = getClient();
    if (!client) { setSession(null); return; }

    client.auth.getSession().then(({ data }) => setSession(data.session ?? null));

    const { data: { subscription } } = client.auth.onAuthStateChange((_, sess) => {
      setSession(sess ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-box">
          <div className="login-brand-box">UB</div>
          <div className="auth-loading-text">Loading…</div>
        </div>
      </div>
    );
  }

  if (!session) return <LoginPage />;
  return <AppContent session={session} />;
}

// ── Main app — only rendered when logged in ───────────────────────
function AppContent({ session }) {
  const board = useBoard();

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar
          darkMode={board.meta.darkMode}
          onToggleDark={board.toggleDarkMode}
          dbStatus={board.dbStatus}
          userEmail={session?.user?.email}
          onLogout={signOut}
        />
        <main className="app-main">
          <Routes>
            <Route path="/"            element={<Navigate to="/dispatch" replace />} />
            <Route path="/dispatch"    element={<DispatchPage    board={board} />} />
            <Route path="/board"       element={<BoardPage       board={board} />} />
            <Route path="/dashboard"   element={<DashboardPage   board={board} />} />
            <Route path="/leaderboard" element={<LeaderboardPage board={board} />} />
            <Route path="/drivers"     element={<DriversPage     board={board} />} />
            <Route path="/history"     element={<HistoryPage     board={board} />} />
            <Route path="/settings"    element={<SettingsPage    board={board} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
