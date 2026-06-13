import { useState } from 'react';
import DayCell from '../components/DayCell';
import { calcWeekStats, calcStreak, getInitials, getAvatarColor, DAYS } from '../data/initialData';
import { exportWeekCSV } from '../utils/export';

const fmt$ = n => n ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const fmtMi = n => n ? `${Number(n).toLocaleString()} mi` : '—';

export default function BoardPage({ board }) {
  const { drivers, meta, updateDay, addDriver, removeDriver, renameDriver, updateMeta, archiveWeek } = board;
  const [activeWeek, setActiveWeek] = useState('weekA');
  const [newName, setNewName] = useState('');

  const wk = activeWeek;
  const wkMeta = wk === 'weekA' ? meta.weekA : meta.weekB;

  const stats = drivers.map(d => ({ ...calcWeekStats(d[wk]), id: d.id }));
  const grandGross = stats.reduce((s, st) => s + st.gross, 0);
  const grandMiles = stats.reduce((s, st) => s + st.miles, 0);
  const grandPm = grandMiles > 0 ? grandGross / grandMiles : null;
  const weekAGross = drivers.reduce((s, d) => s + calcWeekStats(d.weekA).gross, 0);
  const weekBGross = drivers.reduce((s, d) => s + calcWeekStats(d.weekB).gross, 0);
  const maxGross = Math.max(...stats.map(s => s.gross), 1);

  function submit(e) { e.preventDefault(); if (newName.trim()) { addDriver(newName.trim()); setNewName(''); } }

  function handleDayNum(day, val) {
    const n = parseInt(val); if (isNaN(n)) return;
    const cur = wk === 'weekA' ? { ...meta.weekA } : { ...meta.weekB };
    cur.days = { ...cur.days, [day]: n };
    updateMeta(wk === 'weekA' ? { weekA: cur } : { weekB: cur });
  }
  function handleWeekLabel(val) {
    const cur = wk === 'weekA' ? { ...meta.weekA } : { ...meta.weekB };
    cur.label = val;
    updateMeta(wk === 'weekA' ? { weekA: cur } : { weekB: cur });
  }

  return (
    <div className="page" id="print-area">
      <div className="page-header no-print">
        <div className="page-title-block">
          <h1 className="page-title">Weekly Board</h1>
          <span className="page-year-badge" onClick={() => {
            const y = prompt('Enter year:', meta.year);
            if (y && !isNaN(parseInt(y))) updateMeta({ year: parseInt(y) });
          }}>{meta.year}</span>
        </div>
        <div className="kpi-row">
          <div className="kpi green"><div className="kpi-val">{fmt$(grandGross)}</div><div className="kpi-lbl">Total Gross</div></div>
          <div className="kpi blue"><div className="kpi-val">{fmtMi(grandMiles)}</div><div className="kpi-lbl">Total Miles</div></div>
          <div className="kpi amber"><div className="kpi-val">{grandPm ? `$${grandPm.toFixed(2)}/mi` : '—'}</div><div className="kpi-lbl">Fleet Avg $/mi</div></div>
          {meta.threshold > 0 && (
            <div className="kpi rose"><div className="kpi-val">${meta.threshold.toFixed(2)}</div><div className="kpi-lbl">⚠ Alert Threshold</div></div>
          )}
        </div>
      </div>

      <div className="controls-row no-print">
        <div className="week-tabs">
          <button className={`week-tab${activeWeek === 'weekA' ? ' active' : ''}`} onClick={() => setActiveWeek('weekA')}>
            <span>{meta.weekA.label}</span><span className="tab-chip">{fmt$(weekAGross)}</span>
          </button>
          <button className={`week-tab${activeWeek === 'weekB' ? ' active' : ''}`} onClick={() => setActiveWeek('weekB')}>
            <span>{meta.weekB.label}</span><span className="tab-chip">{fmt$(weekBGross)}</span>
          </button>
        </div>
        <div className="board-actions">
          <button className="btn-outline" onClick={() => exportWeekCSV(drivers, wk, wkMeta.label)}>⬇ CSV</button>
          <button className="btn-outline" onClick={() => window.print()}>🖨 Print</button>
          <button className="btn-outline" onClick={() => { if (confirm(`Archive "${wkMeta.label}" to history?`)) archiveWeek(wk); }}>📦 Archive</button>
          <form onSubmit={submit} className="add-form">
            <input className="add-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Add driver..." />
            <button type="submit" className="btn-primary">+ Add</button>
          </form>
        </div>
      </div>

      <div className="board-scroll">
        <table className="btable">
          <thead>
            <tr>
              <th className="th-driver">
                <input className="week-label-input" value={wkMeta.label} onChange={e => handleWeekLabel(e.target.value)} />
              </th>
              {DAYS.map(day => (
                <th key={day} className="th-day">
                  <div className="th-day-name">{day}</div>
                  <input className="th-day-num" type="number" value={wkMeta.days[day] ?? ''} onChange={e => handleDayNum(day, e.target.value)} />
                </th>
              ))}
              <th className="th-total">Week Total</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver, idx) => {
              const st = stats.find(s => s.id === driver.id) || { gross: 0, miles: 0, days: 0, pm: null };
              const color = getAvatarColor(driver.name);
              const streak = calcStreak(driver);
              const pct = (st.gross / maxGross) * 100;
              return (
                <tr key={driver.id} className={`driver-tr${idx % 2 === 0 ? ' even' : ''}`}>
                  <td className="td-driver">
                    <div className="d-info">
                      <div className="d-avatar" style={{ background: color }}>{getInitials(driver.name)}</div>
                      <div className="d-meta">
                        <div className="d-name-row">
                          <div className="d-name" onClick={() => { const n = prompt('Rename:', driver.name); if (n?.trim()) renameDriver(driver.id, n.trim()); }}>
                            {driver.name}
                          </div>
                          {streak > 0 && <span className="streak-badge" title={`${streak} consecutive days`}>🔥{streak}</span>}
                        </div>
                        <div className="d-sub">
                          {driver.truck && <span className="truck-chip">🚛 #{driver.truck}</span>}
                          {st.days} days · {st.miles > 0 ? `${Number(st.miles).toLocaleString()} mi` : '0 mi'}
                        </div>
                        <div className="d-bar-wrap"><div className="d-bar" style={{ width: `${pct}%`, background: color }} /></div>
                      </div>
                      <button className="btn-rm no-print" onClick={() => { if (confirm(`Remove ${driver.name}?`)) removeDriver(driver.id); }}>✕</button>
                    </div>
                  </td>
                  {DAYS.map(day => (
                    <DayCell
                      key={day}
                      data={driver[wk][day]}
                      onUpdate={patch => updateDay(driver.id, wk, day, patch)}
                      threshold={meta.threshold}
                    />
                  ))}
                  <td className="td-total">
                    <div className="tot-gross">{fmt$(st.gross)}</div>
                    {st.miles > 0 && <div className="tot-miles">{Number(st.miles).toLocaleString()} mi</div>}
                    {st.pm && <div className="tot-pm">${st.pm.toFixed(2)}/mi</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="tfoot-row">
              <td className="td-driver tfoot-label">FLEET TOTAL</td>
              {DAYS.map(day => {
                const t = drivers.reduce((s, d) => { const c = d[wk]?.[day]; return s + (c?.status === 'driving' && c.dollars ? c.dollars : 0); }, 0);
                return <td key={day} className="tfoot-day">{t > 0 ? `$${t.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : ''}</td>;
              })}
              <td className="td-total tfoot-grand">
                <div className="tot-gross">{fmt$(grandGross)}</div>
                {grandMiles > 0 && <div className="tot-miles">{Number(grandMiles).toLocaleString()} mi</div>}
                {grandPm && <div className="tot-pm">${grandPm.toFixed(2)}/mi</div>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
