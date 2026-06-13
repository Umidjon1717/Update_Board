import { useState } from 'react';
import { signIn, isConfigured, setCredentials, getClient } from '../lib/supabase';

export default function LoginPage() {
  const configured = isConfigured();

  // Setup mode (first time on a new device — no Supabase credentials yet)
  const [mode, setMode]     = useState(configured ? 'login' : 'setup');
  const [sbUrl, setSbUrl]   = useState('');
  const [sbKey, setSbKey]   = useState('');

  // Login mode
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  function handleSetup(e) {
    e.preventDefault();
    if (!sbUrl.trim() || !sbKey.trim()) return;
    setCredentials(sbUrl.trim(), sbKey.trim());
    setMode('login');
    setError('');
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await signIn(email, password);
    if (result?.error) {
      setError(result.error.message);
      setLoading(false);
    }
    // on success → onAuthStateChange in App.jsx fires and switches to main app
  }

  if (mode === 'setup') {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand-box">UB</div>
          <div className="login-title">UpdateBoard</div>
          <div className="login-sub">First-time setup — enter your Supabase credentials</div>
          <form className="login-form" onSubmit={handleSetup}>
            <input
              className="login-input"
              placeholder="Supabase Project URL"
              value={sbUrl}
              onChange={e => setSbUrl(e.target.value)}
              required
            />
            <input
              className="login-input"
              type="password"
              placeholder="Publishable Key"
              value={sbKey}
              onChange={e => setSbKey(e.target.value)}
              required
            />
            <button className="login-btn" type="submit">Continue →</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand-box">UB</div>
        <div className="login-title">UpdateBoard</div>
        <div className="login-sub">Fleet Manager · Sign in to continue</div>
        <form className="login-form" onSubmit={handleLogin}>
          <div className="login-field">
            <label className="login-label">Email</label>
            <input
              className="login-input"
              type="email"
              placeholder="admin@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="login-field">
            <label className="login-label">Password</label>
            <input
              className="login-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
