import { useState } from 'react';
import { calcWeekStats, calcStreak, getInitials, getAvatarColor, getWeekLabel, blankDay, DAYS } from '../data/initialData';

const fmt$  = n => n ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
const fmtMi = n => n ? `${Number(n).toLocaleString()} mi` : '—';

function StatBadge({ label, value, color }) {
  return (
    <div className="stat-badge" style={{ '--badge-color': color }}>
      <div className="stat-badge-val">{value}</div>
      <div className="stat-badge-lbl">{label}</div>
    </div>
  );
}

function DayDots({ weekData }) {
  return (
    <div className="day-dots">
      {DAYS.map(day => {
        const c = weekData?.[day] || blankDay();
        let cls = 'dot-empty';
        if (c.status === 'HOME') cls = 'dot-home';
        else if (c.status === 'TRANSIT') cls = 'dot-transit';
        else if (c.dollars) cls = 'dot-earning';
        const note = c.notes ? ` · ${c.notes}` : '';
        return (
          <div key={day} className={`day-dot ${cls}`} title={`${day}: ${c.status === 'driving' ? (c.dollars ? `${fmt$(c.dollars)}${note}` : 'empty') : c.status}`}>
            <span className="dot-day">{day[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DriversPage({ board }) {
  const { drivers, meta, currentWeek, addDriver, renameDriver, updateDriverInfo } = board;
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');

  const currentLabel = getWeekLabel(currentWeek, meta.startDate);
  const maxCur = Math.max(...drivers.map(d => calcWeekStats(d.weeks?.[currentWeek] || {}).gross), 1);

  const filtered = drivers.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  function submit(e) { e.preventDefault(); if (newName.trim()) { addDriver(newName.trim()); setNewName(''); } }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Drivers</h1>
          <span className="page-subtitle">{drivers.length} drivers in fleet</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="search-input" placeholder="Search drivers..." value={search} onChange={e => setSearch(e.target.value)} />
          <form onSubmit={submit} className="add-form">
            <input className="add-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="New driver..." />
            <button type="submit" className="btn-primary">+ Add</button>
          </form>
        </div>
      </div>

      <div className="drivers-grid">
        {filtered.map(driver => {
          const stCur = calcWeekStats(driver.weeks?.[currentWeek] || {});
          const color  = getAvatarColor(driver.name);
          const streak = calcStreak(driver);
          const pctCur = (stCur.gross / maxCur) * 100;

          return (
            <div key={driver.id} className="driver-card">
              <div className="dc-header" style={{ background: color }}>
                <div className="dc-avatar">{getInitials(driver.name)}</div>
                <div className="dc-header-info">
                  {driver.truck && <span className="dc-truck">#{driver.truck}</span>}
                  {streak > 0 && <span className="dc-streak">🔥 {streak}d streak</span>}
                </div>
              </div>
              <div className="dc-body">
                <div className="dc-name" onClick={() => { const n = prompt('Rename:', driver.name); if (n?.trim()) renameDriver(driver.id, n.trim()); }}>
                  {driver.name}
                </div>
                {driver.phone && (
                  <div className="dc-contact">
                    <span>📞</span>
                    <input
                      className="dc-contact-input"
                      value={driver.phone}
                      onChange={e => updateDriverInfo(driver.id, { phone: e.target.value })}
                      placeholder="Phone..."
                    />
                  </div>
                )}
                <div className="dc-info-row">
                  <div className="dc-info-item">
                    <span className="dc-info-lbl">Truck</span>
                    <input className="dc-info-input" value={driver.truck || ''} onChange={e => updateDriverInfo(driver.id, { truck: e.target.value })} placeholder="#" />
                  </div>
                  <div className="dc-info-item">
                    <span className="dc-info-lbl">Trailer</span>
                    <input className="dc-info-input" value={driver.trailer || ''} onChange={e => updateDriverInfo(driver.id, { trailer: e.target.value })} placeholder="#" />
                  </div>
                </div>

                <div className="dc-week-label">{currentLabel}</div>
                <div className="dc-stats-row">
                  <StatBadge label="Gross" value={fmt$(stCur.gross)}                          color="#22c55e" />
                  <StatBadge label="Miles" value={fmtMi(stCur.miles)}                         color="#3b82f6" />
                  <StatBadge label="$/mi"  value={stCur.pm ? `$${stCur.pm.toFixed(2)}` : '—'} color="#f59e0b" />
                  <StatBadge label="Days"  value={stCur.days}                                 color="#8b5cf6" />
                </div>
                <div className="dc-progress-wrap">
                  <div className="dc-progress" style={{ width: `${pctCur}%`, background: color }} />
                </div>
                <DayDots weekData={driver.weeks?.[currentWeek]} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
