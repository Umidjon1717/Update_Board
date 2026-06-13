import { useState } from 'react';
import { getInitials, getAvatarColor } from '../data/initialData';

const fmt$ = n => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function HistoryPage({ board }) {
  const { meta, deleteHistory } = board;
  const history = meta.history || [];
  const [expanded, setExpanded] = useState(null);

  if (history.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="page-title-block"><h1 className="page-title">History</h1></div>
        </div>
        <div className="empty-state">
          <div className="empty-icon">🗂</div>
          <div className="empty-title">No archived weeks yet</div>
          <div className="empty-sub">Go to Weekly Board → click "📦 Archive" to save a week here</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">History</h1>
          <span className="page-subtitle">{history.length} archived week{history.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="hist-total">
          <span className="hist-total-lbl">Total Archived Gross</span>
          <span className="hist-total-val">{fmt$(history.reduce((s, h) => s + (h.gross || 0), 0))}</span>
        </div>
      </div>

      <div className="history-list">
        {history.map(h => {
          const isOpen = expanded === h.id;
          const sorted = [...(h.drivers || [])].sort((a, b) => (b.stats?.gross || 0) - (a.stats?.gross || 0));
          return (
            <div key={h.id} className="hist-card">
              <div className="hist-card-header" onClick={() => setExpanded(isOpen ? null : h.id)}>
                <div className="hist-left">
                  <div className="hist-label">{h.label}</div>
                  <div className="hist-date">{h.year} · Archived {new Date(h.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div className="hist-stats">
                  <div className="hist-stat"><span className="hs-val green">{fmt$(h.gross)}</span><span className="hs-lbl">Gross</span></div>
                  <div className="hist-stat"><span className="hs-val blue">{h.miles > 0 ? `${Number(h.miles).toLocaleString()} mi` : '—'}</span><span className="hs-lbl">Miles</span></div>
                  <div className="hist-stat"><span className="hs-val">{(h.drivers || []).length}</span><span className="hs-lbl">Drivers</span></div>
                </div>
                <div className="hist-actions">
                  <button className="btn-outline sm" onClick={e => { e.stopPropagation(); if (confirm('Delete this archived week?')) deleteHistory(h.id); }}>🗑 Delete</button>
                  <span className="hist-chevron">{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {isOpen && (
                <div className="hist-detail">
                  <table className="hist-table">
                    <thead>
                      <tr>
                        <th>#</th><th>Driver</th><th>Truck</th><th>Gross</th><th>Miles</th><th>$/mi</th><th>Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((d, i) => {
                        const color = getAvatarColor(d.name);
                        return (
                          <tr key={d.id} className={i < 3 ? 'hist-top' : ''}>
                            <td className="hist-rank">#{i + 1}</td>
                            <td>
                              <div className="d-info">
                                <div className="d-avatar sm" style={{ background: color }}>{getInitials(d.name)}</div>
                                <span className="d-name-sm">{d.name}</span>
                              </div>
                            </td>
                            <td>{d.truck || '—'}</td>
                            <td className="hist-gross">{fmt$(d.stats?.gross)}</td>
                            <td className="hist-miles">{d.stats?.miles > 0 ? `${Number(d.stats.miles).toLocaleString()} mi` : '—'}</td>
                            <td className="hist-pm">{d.stats?.pm ? `$${d.stats.pm.toFixed(2)}` : '—'}</td>
                            <td>{d.stats?.days || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
