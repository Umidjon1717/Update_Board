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
    if (!sbUrl.trim().startsWith('https://')) {
      setError('Project URL must start with https:// (e.g. https://xxxx.supabase.co)');
      return;
    }
    try {
      setCredentials(sbUrl.trim(), sbKey.trim());
      setMode('login');
      setError('');
    } catch (err) {
      setError(err.message);
    }
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
            <div className="login-field">
              <label className="login-label">Supabase Project URL</label>
              <input
                className="login-input"
                placeholder="https://xxxx.supabase.co"
                value={sbUrl}
                onChange={e => setSbUrl(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="login-field">
              <label className="login-label">Publishable Key (from Supabase → Settings → API)</label>
              <input
                className="login-input"
                type="password"
                placeholder="sb_publishable_…"
                value={sbKey}
                onChange={e => setSbKey(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="conn-help" style={{color:'#64748b',fontSize:'11px',marginBottom:'4px'}}>
              This is a one-time setup. After this you will see the email/password login.
            </div>
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
