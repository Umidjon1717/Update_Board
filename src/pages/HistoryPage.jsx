import { useState } from 'react';
import { getInitials, getAvatarColor, getWeekSummary, calcWeekStats, DAYS } from '../data/initialData';

const fmt$  = n => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtMi = n => n > 0 ? `${Number(n).toLocaleString()} mi` : '—';

function monthLabel(weekKey) {
  return new Date(weekKey + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function HistoryPage({ board }) {
  const { drivers, meta, allWeekKeys } = board;
  const [expanded, setExpanded] = useState(null);

  // Every past week (everything before the in-progress current week) — no manual archiving needed,
  // the data has lived under its own date key all along.
  const pastWeeks = allWeekKeys.filter(wk => wk !== meta.currentWeek);

  if (pastWeeks.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="page-title-block"><h1 className="page-title">History</h1></div>
        </div>
        <div className="empty-state">
          <div className="empty-icon">🗂</div>
          <div className="empty-title">No past weeks yet</div>
          <div className="empty-sub">Once you advance past the current week on the Weekly Board, it'll show up here automatically.</div>
        </div>
      </div>
    );
  }

  const summaries = pastWeeks.map(wk => getWeekSummary(drivers, wk, meta.startDate)).sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  const allTimeGross = summaries.reduce((s, w) => s + w.gross, 0);
  const allTimeMiles = summaries.reduce((s, w) => s + w.miles, 0);
  const bestWeek = [...summaries].sort((a, b) => b.gross - a.gross)[0];

  // Group by month, preserving descending order
  const groups = [];
  summaries.forEach(w => {
    const label = monthLabel(w.weekKey);
    let g = groups.find(g => g.label === label);
    if (!g) { g = { label, weeks: [] }; groups.push(g); }
    g.weeks.push(w);
  });

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">History</h1>
          <span className="page-subtitle">{summaries.length} past week{summaries.length !== 1 ? 's' : ''} on record</span>
        </div>
        <div className="hist-total">
          <span className="hist-total-lbl">All-Time Gross</span>
          <span className="hist-total-val">{fmt$(allTimeGross)}</span>
        </div>
      </div>

      <div className="hist-kpi-row">
        <div className="hist-kpi">
          <div className="hist-kpi-val">{fmt$(allTimeGross)}</div>
          <div className="hist-kpi-lbl">Total Gross</div>
        </div>
        <div className="hist-kpi">
          <div className="hist-kpi-val">{fmtMi(allTimeMiles)}</div>
          <div className="hist-kpi-lbl">Total Miles</div>
        </div>
        {bestWeek && (
          <div className="hist-kpi gold">
            <div className="hist-kpi-val">🏆 {fmt$(bestWeek.gross)}</div>
            <div className="hist-kpi-lbl">Best Week — {bestWeek.range}</div>
          </div>
        )}
      </div>

      {groups.map(group => {
        const monthTotal = group.weeks.reduce((s, w) => s + w.gross, 0);
        return (
          <div key={group.label} className="hist-month-group">
            <div className="hist-month-header">
              <span className="hist-month-name">{group.label}</span>
              <span className="hist-month-total">{fmt$(monthTotal)}</span>
            </div>

            <div className="history-list">
              {group.weeks.map(w => {
                const isOpen = expanded === w.weekKey;
                const isBest = bestWeek && w.weekKey === bestWeek.weekKey;
                const driverRows = drivers
                  .map(d => ({ ...d, stats: calcWeekStats(d.weeks?.[w.weekKey] || {}) }))
                  .filter(d => d.stats.gross > 0 || d.stats.days > 0)
                  .sort((a, b) => b.stats.gross - a.stats.gross);

                return (
                  <div key={w.weekKey} className={`hist-card${isBest ? ' hist-best' : ''}`}>
                    <div className="hist-card-header" onClick={() => setExpanded(isOpen ? null : w.weekKey)}>
                      <div className="hist-left">
                        <div className="hist-label">{w.label}{isBest && <span className="hist-best-badge">🏆 Best</span>}</div>
                        <div className="hist-date">{w.activeDrivers} active driver{w.activeDrivers !== 1 ? 's' : ''}{w.topDriver ? ` · Top: ${w.topDriver.split(' ')[0]}` : ''}</div>
                      </div>
                      <div className="hist-stats">
                        <div className="hist-stat"><span className="hs-val green">{fmt$(w.gross)}</span><span className="hs-lbl">Gross</span></div>
                        <div className="hist-stat"><span className="hs-val blue">{fmtMi(w.miles)}</span><span className="hs-lbl">Miles</span></div>
                        <div className="hist-stat"><span className="hs-val">{w.pm ? `$${w.pm.toFixed(2)}` : '—'}</span><span className="hs-lbl">$/mi</span></div>
                      </div>
                      <div className="hist-actions">
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
                            {driverRows.map((d, i) => {
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
                                  <td className="hist-gross">{fmt$(d.stats.gross)}</td>
                                  <td className="hist-miles">{fmtMi(d.stats.miles)}</td>
                                  <td className="hist-pm">{d.stats.pm ? `$${d.stats.pm.toFixed(2)}` : '—'}</td>
                                  <td>{d.stats.days}</td>
                                </tr>
                              );
                            })}
                            {driverRows.length === 0 && (
                              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>No activity this week</td></tr>
                            )}
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
      })}
    </div>
  );
}
