import { useState } from 'react';
import { calcWeekStats, getInitials, getAvatarColor, getWeekLabel } from '../data/initialData';

const fmt$  = n => n ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
const fmtMi = n => n ? `${Number(n).toLocaleString()} mi` : '—';

const MEDALS       = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32'];

export default function LeaderboardPage({ board }) {
  const { drivers, meta, allWeekKeys } = board;
  const [viewWeek, setViewWeek] = useState(meta.currentWeek);

  const ranked = drivers
    .map(d => ({ ...d, ...calcWeekStats(d.weeks?.[viewWeek] || {}) }))
    .sort((a, b) => b.gross - a.gross);

  const maxGross = ranked[0]?.gross || 1;
  const top3     = ranked.slice(0, 3);
  const rest     = ranked.slice(3);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Leaderboard</h1>
          <span className="page-subtitle">Who's crushing it this week</span>
        </div>
        {allWeekKeys.length > 1 && (
          <div className="seg-ctrl" style={{ flexWrap: 'wrap', maxWidth: 480 }}>
            {[...allWeekKeys].reverse().slice(0, 4).map(wk => (
              <button key={wk} className={`seg-btn${viewWeek === wk ? ' active' : ''}`} onClick={() => setViewWeek(wk)}>
                {getWeekLabel(wk, meta.startDate).split(' · ')[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="podium-section">
        {top3.length >= 2 && (
          <div className="podium-card p2">
            <div className="podium-medal">🥈</div>
            <div className="podium-avatar" style={{ background: getAvatarColor(top3[1].name) }}>
              {getInitials(top3[1].name)}
            </div>
            <div className="podium-name">{top3[1].name.split(' ')[0]}</div>
            <div className="podium-gross" style={{ color: MEDAL_COLORS[1] }}>{fmt$(top3[1].gross)}</div>
            <div className="podium-sub">{fmtMi(top3[1].miles)}</div>
            <div className="podium-rank-bar p2-bar" />
          </div>
        )}
        {top3.length >= 1 && (
          <div className="podium-card p1">
            <div className="podium-crown">👑</div>
            <div className="podium-medal">🥇</div>
            <div className="podium-avatar big" style={{ background: getAvatarColor(top3[0].name) }}>
              {getInitials(top3[0].name)}
            </div>
            <div className="podium-name">{top3[0].name.split(' ')[0]}</div>
            <div className="podium-gross" style={{ color: MEDAL_COLORS[0] }}>{fmt$(top3[0].gross)}</div>
            <div className="podium-sub">{fmtMi(top3[0].miles)}</div>
            <div className="podium-rank-bar p1-bar" />
          </div>
        )}
        {top3.length >= 3 && (
          <div className="podium-card p3">
            <div className="podium-medal">🥉</div>
            <div className="podium-avatar" style={{ background: getAvatarColor(top3[2].name) }}>
              {getInitials(top3[2].name)}
            </div>
            <div className="podium-name">{top3[2].name.split(' ')[0]}</div>
            <div className="podium-gross" style={{ color: MEDAL_COLORS[2] }}>{fmt$(top3[2].gross)}</div>
            <div className="podium-sub">{fmtMi(top3[2].miles)}</div>
            <div className="podium-rank-bar p3-bar" />
          </div>
        )}
        {top3.length === 0 && (
          <div className="chart-empty" style={{ width: '100%' }}>No earnings data yet — fill in the Weekly Board first</div>
        )}
      </div>

      <div className="lb-table-wrap">
        <table className="lb-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Driver</th>
              <th>Gross</th>
              <th>Miles</th>
              <th>$/mi</th>
              <th>Days</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((d, i) => {
              const pct   = maxGross > 0 ? (d.gross / maxGross) * 100 : 0;
              const color = getAvatarColor(d.name);
              return (
                <tr key={d.id} className={`lb-row${i < 3 ? ' lb-top' : ''}`}>
                  <td className="lb-rank">
                    {i < 3
                      ? <span className="lb-medal">{MEDALS[i]}</span>
                      : <span className="lb-rank-num">#{i + 1}</span>
                    }
                  </td>
                  <td className="lb-driver">
                    <div className="d-info">
                      <div className="d-avatar sm" style={{ background: color }}>{getInitials(d.name)}</div>
                      <span className="d-name-sm">{d.name}</span>
                    </div>
                  </td>
                  <td className="lb-gross">{fmt$(d.gross)}</td>
                  <td className="lb-miles">{fmtMi(d.miles)}</td>
                  <td className="lb-pm">{d.pm ? `$${d.pm.toFixed(2)}` : '—'}</td>
                  <td className="lb-days">{d.days}</td>
                  <td className="lb-bar-cell">
                    <div className="lb-bar-track">
                      <div className="lb-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="lb-bar-pct">{pct.toFixed(0)}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
