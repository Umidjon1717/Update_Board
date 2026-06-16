import { useState, useEffect, useRef } from 'react';
import DayCell from '../components/DayCell';
import {
  calcWeekStats, calcStreak, getInitials, getAvatarColor,
  getWeekDates, getWeekLabel, getNextWeekKey, getPrevWeekKey, blankDay, DAYS,
} from '../data/initialData';
import { exportWeekCSV } from '../utils/export';

const fmt$ = n => n ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function BoardPage({ board }) {
  const { drivers, meta, updateDay, addDriver, removeDriver, renameDriver, allWeekKeys, updateMeta } = board;
  const [viewWeek, setViewWeek] = useState(meta.currentWeek || '2026-06-22');
  const [newName, setNewName] = useState('');

  // One-time sanity check: if viewWeek somehow isn't a valid date key, snap to currentWeek.
  useEffect(() => {
    if (!ISO_DATE.test(viewWeek)) setViewWeek(meta.currentWeek);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // If the real "current week" advances while this tab is looking at it live,
  // follow along. But if someone has manually browsed elsewhere (history or a
  // peeked-ahead future week), leave them right where they are.
  const prevCurrentWeek = useRef(meta.currentWeek);
  useEffect(() => {
    if (viewWeek === prevCurrentWeek.current && meta.currentWeek !== prevCurrentWeek.current) {
      setViewWeek(meta.currentWeek);
    }
    prevCurrentWeek.current = meta.currentWeek;
  }, [meta.currentWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  const weekIdx     = allWeekKeys.indexOf(viewWeek);
  const canPrev     = viewWeek > meta.startDate;
  const isCurrentWk = viewWeek === meta.currentWeek;
  const weekDates   = getWeekDates(viewWeek);
  const weekLabel   = getWeekLabel(viewWeek, meta.startDate);

  const stats      = drivers.map(d => ({ ...calcWeekStats(d.weeks?.[viewWeek] || {}), id: d.id }));
  const grandGross = stats.reduce((s, st) => s + st.gross, 0);
  const grandMiles = stats.reduce((s, st) => s + st.miles, 0);
  const grandPm    = grandMiles > 0 ? grandGross / grandMiles : null;
  const maxGross   = Math.max(...stats.map(s => s.gross), 1);

  function submit(e) {
    e.preventDefault();
    if (newName.trim()) { addDriver(newName.trim()); setNewName(''); }
  }

  // Browsing to a different week (even into the future to pre-plan, or back
  // into an empty past week) is purely local — it never redefines what
  // "Current" means for the rest of the app. Only the real calendar date does.
  function goPrev() {
    if (!canPrev) return;
    setViewWeek(weekIdx > 0 ? allWeekKeys[weekIdx - 1] : getPrevWeekKey(viewWeek));
  }
  function goNext() {
    setViewWeek(weekIdx !== -1 && weekIdx < allWeekKeys.length - 1 ? allWeekKeys[weekIdx + 1] : getNextWeekKey(viewWeek));
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
          <div className="kpi green"><div className="kpi-val">{fmt$(grandGross)}</div><div className="kpi-lbl">Week Gross</div></div>
          <div className="kpi blue"><div className="kpi-val">{grandMiles > 0 ? `${Number(grandMiles).toLocaleString()} mi` : '—'}</div><div className="kpi-lbl">Total Miles</div></div>
          <div className="kpi amber"><div className="kpi-val">{grandPm ? `$${grandPm.toFixed(2)}/mi` : '—'}</div><div className="kpi-lbl">Fleet Avg $/mi</div></div>
        </div>
      </div>

      <div className="controls-row no-print">
        <div className="week-nav">
          <button className="week-nav-btn" onClick={goPrev} disabled={!canPrev}>←</button>
          <div className="week-nav-label">
            {weekLabel}
            {isCurrentWk && <span className="week-live-badge">● Current</span>}
          </div>
          <button className="week-nav-btn" onClick={goNext}>→</button>
        </div>
        <div className="board-actions">
          <button className="btn-outline" onClick={() => exportWeekCSV(drivers, viewWeek, weekLabel)}>⬇ CSV</button>
          <button className="btn-outline" onClick={() => window.print()}>🖨 Print</button>
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
              <th className="th-driver">{weekLabel}</th>
              {weekDates.map(({ day, full }) => (
                <th key={day} className="th-day">
                  <div className="th-day-name">{day}</div>
                  <div className="th-day-date">{full}</div>
                </th>
              ))}
              <th className="th-total">Total</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver, idx) => {
              const st     = stats.find(s => s.id === driver.id) || { gross: 0, miles: 0, days: 0, pm: null };
              const color  = getAvatarColor(driver.name);
              const streak = calcStreak(driver);
              const pct    = (st.gross / maxGross) * 100;
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
                  {DAYS.map(day => {
                    const cellData = driver.weeks?.[viewWeek]?.[day] || blankDay();
                    return (
                      <DayCell
                        key={day}
                        data={cellData}
                        onUpdate={patch => updateDay(driver.id, viewWeek, day, patch)}
                      />
                    );
                  })}
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
                const t = drivers.reduce((s, d) => {
                  const c = d.weeks?.[viewWeek]?.[day];
                  return s + (c?.status === 'driving' && c.dollars ? c.dollars : 0);
                }, 0);
                return (
                  <td key={day} className="tfoot-day">
                    {t > 0 ? `$${t.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : ''}
                  </td>
                );
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
