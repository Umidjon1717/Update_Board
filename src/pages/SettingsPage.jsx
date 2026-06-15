import { useState } from 'react';
import { getCredentials } from '../lib/supabase';

export default function SettingsPage({ board }) {
  const { meta, dbStatus, updateMeta, toggleDarkMode, connectDB, disconnectDB } = board;
  const [yearVal, setYearVal] = useState(meta.year);

  const creds = getCredentials();
  const [sbUrl,    setSbUrl]    = useState(creds.url);
  const [sbKey,    setSbKey]    = useState(creds.key);
  const [connMsg,  setConnMsg]  = useState('');
  const [connBusy, setConnBusy] = useState(false);
  const [showKey,  setShowKey]  = useState(false);

  function saveGeneral() {
    updateMeta({ year: parseInt(yearVal) || meta.year });
    alert('Saved!');
  }

  async function handleConnect() {
    if (!sbUrl.trim() || !sbKey.trim()) { setConnMsg('Enter both URL and anon key.'); return; }
    setConnBusy(true);
    setConnMsg('');
    const result = await connectDB(sbUrl.trim(), sbKey.trim());
    setConnBusy(false);
    if (result.success) {
      setConnMsg(result.action === 'pushed'
        ? '✓ Connected and uploaded local data to Supabase.'
        : '✓ Connected and loaded data from Supabase.');
    } else {
      setConnMsg(`✗ Failed: ${result.error}`);
    }
  }

  function handleDisconnect() {
    if (!confirm('Disconnect from Supabase? Your data stays in localStorage.')) return;
    disconnectDB();
    setSbUrl('');
    setSbKey('');
    setConnMsg('Disconnected. Data is now local only.');
  }

  function clearAll() {
    if (confirm('⚠ This will delete ALL data including drivers, earnings, and history. Cannot be undone. Are you sure?')) {
      if (confirm('Really sure? This is permanent.')) {
        localStorage.clear();
        window.location.reload();
      }
    }
  }

  const isConnected = dbStatus === 'connected';

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Settings</h1>
        </div>
      </div>

      <div className="settings-grid">
        {/* ── Cloud Sync ── */}
        <div className="settings-card settings-card--wide">
          <div className="settings-card-title">☁ Cloud Sync (Supabase)</div>
          <p className="settings-desc">
            Connect to Supabase for real-time sync across all devices.
            {' '}<strong>Free tier</strong> is enough — create a project at supabase.com, run the SQL from
            {' '}<code>supabase_schema.sql</code>, then paste the URL and anon key below.
          </p>

          {isConnected ? (
            <div className="conn-connected-block">
              <div className="conn-status-row">
                <span className="conn-dot connected" />
                <span className="conn-label">Connected to Supabase — all changes sync in real-time</span>
              </div>
              <div className="conn-url-display">{creds.url}</div>
              <button className="btn-outline sm" onClick={handleDisconnect}>Disconnect</button>
            </div>
          ) : (
            <div className="conn-form">
              <div className="settings-field">
                <label className="settings-label">Project URL</label>
                <input
                  className="settings-input"
                  placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                  value={sbUrl}
                  onChange={e => setSbUrl(e.target.value)}
                  disabled={connBusy}
                />
              </div>
              <div className="settings-field">
                <label className="settings-label">Anon / Public Key</label>
                <div className="settings-input-row">
                  <input
                    className="settings-input"
                    type={showKey ? 'text' : 'password'}
                    placeholder="eyJhbGci…"
                    value={sbKey}
                    onChange={e => setSbKey(e.target.value)}
                    disabled={connBusy}
                  />
                  <button className="btn-outline sm" onClick={() => setShowKey(v => !v)} style={{ flexShrink: 0 }}>
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div className="conn-help">Find these in Supabase → Project Settings → API</div>
              <button className="btn-primary" onClick={handleConnect} disabled={connBusy}>
                {connBusy ? 'Connecting…' : 'Connect'}
              </button>
              {dbStatus === 'error' && !connMsg && (
                <div className="conn-msg error">Could not connect on startup — check your credentials.</div>
              )}
            </div>
          )}

          {connMsg && (
            <div className={`conn-msg${connMsg.startsWith('✓') ? ' ok' : ' error'}`}>{connMsg}</div>
          )}
        </div>

        {/* ── General ── */}
        <div className="settings-card">
          <div className="settings-card-title">General</div>
          <div className="settings-field">
            <label className="settings-label">Year</label>
            <input className="settings-input" type="number" value={yearVal} onChange={e => setYearVal(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={saveGeneral}>Save Changes</button>
        </div>

        {/* ── Appearance ── */}
        <div className="settings-card">
          <div className="settings-card-title">Appearance</div>
          <div className="settings-field row">
            <div>
              <label className="settings-label">Dark Mode</label>
              <p className="settings-desc">Toggle dark/light theme</p>
            </div>
            <button className={`toggle-btn${meta.darkMode ? ' on' : ''}`} onClick={toggleDarkMode}>
              <div className="toggle-knob" />
            </button>
          </div>
        </div>

        {/* ── Danger Zone ── */}
        <div className="settings-card danger-card">
          <div className="settings-card-title danger">⚠ Danger Zone</div>
          <p className="settings-desc">Permanently delete all local data. This cannot be undone.</p>
          <button className="btn-danger" onClick={clearAll}>🗑 Reset All Data</button>
        </div>
      </div>
    </div>
  );
}
