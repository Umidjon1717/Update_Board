import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, Cell, Legend } from 'recharts';
import { calcWeekStats, getDailyTotals, DAYS } from '../data/initialData';

const fmt$ = n => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmt$2 = n => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f43f5e','#ec4899','#06b6d4','#84cc16'];

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="tooltip-label">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="tooltip-row" style={{ color: p.color }}>
          <span>{p.name || p.dataKey}:</span><strong>{fmt$(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage({ board }) {
  const { drivers, meta } = board;
  const [view, setView] = useState('weekA');

  const statsA = drivers.map(d => ({ name: d.name.split(' ')[0], full: d.name, ...calcWeekStats(d.weekA) }));
  const statsB = drivers.map(d => ({ name: d.name.split(' ')[0], full: d.name, ...calcWeekStats(d.weekB) }));
  const current = view === 'weekB' ? statsB : statsA;

  const grandGross  = current.reduce((s, d) => s + d.gross, 0);
  const grandMiles  = current.reduce((s, d) => s + d.miles, 0);
  const monthlyGross = drivers.reduce((s, d) => s + calcWeekStats(d.weekA).gross + calcWeekStats(d.weekB).gross, 0);
  const activeDrivers = current.filter(d => d.days > 0).length;
  const topDriver = [...current].sort((a, b) => b.gross - a.gross)[0];
  const historyGross = (meta.history || []).reduce((s, h) => s + (h.gross || 0), 0);

  const barData = [...current].filter(d => d.gross > 0).sort((a, b) => b.gross - a.gross);
  const dailyA = getDailyTotals(drivers, 'weekA');
  const dailyB = getDailyTotals(drivers, 'weekB');
  const trendData = DAYS.map((day, i) => ({ day, [meta.weekA.label]: dailyA[i].total, [meta.weekB.label]: dailyB[i].total }));
  const compareData = drivers
    .map(d => ({ name: d.name.split(' ')[0], [meta.weekA.label]: calcWeekStats(d.weekA).gross, [meta.weekB.label]: calcWeekStats(d.weekB).gross }))
    .filter(d => d[meta.weekA.label] > 0 || d[meta.weekB.label] > 0);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Dashboard</h1>
          <span className="page-subtitle">{meta.year} Analytics</span>
        </div>
        <div className="seg-ctrl">
          {['weekA', 'weekB'].map(v => (
            <button key={v} className={`seg-btn${view === v ? ' active' : ''}`} onClick={() => setView(v)}>
              {v === 'weekA' ? meta.weekA.label : meta.weekB.label}
            </button>
          ))}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card green">
          <div className="kpi-card-icon">💰</div>
          <div className="kpi-card-val">{fmt$2(grandGross)}</div>
          <div className="kpi-card-lbl">Week Gross</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-card-icon">📅</div>
          <div className="kpi-card-val">{fmt$2(monthlyGross)}</div>
          <div className="kpi-card-lbl">Combined (Both Weeks)</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-card-icon">🛣️</div>
          <div className="kpi-card-val">{grandMiles > 0 ? `${Number(grandMiles).toLocaleString()} mi` : '—'}</div>
          <div className="kpi-card-lbl">Total Miles</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-card-icon">⚡</div>
          <div className="kpi-card-val">{grandMiles > 0 ? `$${(grandGross / grandMiles).toFixed(2)}/mi` : '—'}</div>
          <div className="kpi-card-lbl">Fleet Avg $/mi</div>
        </div>
        <div className="kpi-card rose">
          <div className="kpi-card-icon">🏆</div>
          <div className="kpi-card-val">{topDriver?.gross > 0 ? topDriver.name : '—'}</div>
          <div className="kpi-card-lbl">Top Earner · {topDriver?.gross > 0 ? fmt$2(topDriver.gross) : ''}</div>
        </div>
        <div className="kpi-card teal">
          <div className="kpi-card-icon">🚛</div>
          <div className="kpi-card-val">{activeDrivers}</div>
          <div className="kpi-card-lbl">Active Drivers</div>
        </div>
        <div className="kpi-card slate">
          <div className="kpi-card-icon">📊</div>
          <div className="kpi-card-val">{activeDrivers > 0 ? fmt$(grandGross / activeDrivers) : '—'}</div>
          <div className="kpi-card-lbl">Avg per Driver</div>
        </div>
        {meta.history?.length > 0 && (
          <div className="kpi-card indigo">
            <div className="kpi-card-icon">🗂</div>
            <div className="kpi-card-val">{fmt$2(historyGross)}</div>
            <div className="kpi-card-lbl">Archived Gross ({meta.history.length} weeks)</div>
          </div>
        )}
      </div>

      <div className="charts-grid">
        <div className="chart-card wide">
          <div className="chart-card-title">Earnings by Driver — {view === 'weekA' ? meta.weekA.label : meta.weekB.label}</div>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ top: 8, right: 16, left: 8, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="gross" radius={[6, 6, 0, 0]}>
                  {barData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="chart-empty">No data yet — add earnings in the Weekly Board</div>}
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Daily Gross Trend</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip content={<Tip />} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey={meta.weekA.label} stroke="#22c55e" fill="url(#gA)" strokeWidth={2} dot={{ r: 3 }} />
              <Area type="monotone" dataKey={meta.weekB.label} stroke="#3b82f6" fill="url(#gB)" strokeWidth={2} dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Week A vs Week B per Driver</div>
          {compareData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={compareData} margin={{ top: 8, right: 16, left: 8, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip content={<Tip />} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey={meta.weekA.label} fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey={meta.weekB.label} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="chart-empty">No data yet</div>}
        </div>
      </div>
    </div>
  );
}
