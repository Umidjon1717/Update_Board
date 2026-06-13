import { useState, useRef, useEffect } from 'react';
import { getInitials, getAvatarColor, DISPATCH_STATUSES, STATUS_CFG } from '../data/initialData';
import { exportDispatchCSV } from '../utils/export';

/* ── inline editable cell ── */
function EditCell({ value, onChange, placeholder = '—', wide }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);
  if (editing) {
    return (
      <input
        ref={ref}
        className={`dc-input${wide ? ' wide' : ''}`}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={e => { if (e.key === 'Enter') setEditing(false); }}
        placeholder={placeholder}
      />
    );
  }
  return (
    <div className={`dc-cell${wide ? ' wide' : ''}`} onClick={() => setEditing(true)}>
      {value || <span className="dc-ph">{placeholder}</span>}
    </div>
  );
}

/* ── status selector ── */
function StatusCell({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);
  const cfg = STATUS_CFG[value] || { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
  return (
    <div ref={ref} className="status-wrap">
      <button
        className="status-pill-btn"
        style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
        onClick={() => setOpen(o => !o)}
      >
        {value || 'SET'} <span className="status-arr">▾</span>
      </button>
      {open && (
        <div className="status-drop">
          {DISPATCH_STATUSES.map(s => {
            const c = STATUS_CFG[s];
            return (
              <button
                key={s}
                className="status-opt"
                style={{ background: c.bg, color: c.text }}
                onClick={() => { onChange(s); setOpen(false); }}
              >
                {s}
              </button>
            );
          })}
          <button className="status-opt" style={{ background: '#f1f5f9', color: '#64748b' }} onClick={() => { onChange(''); setOpen(false); }}>— Clear</button>
        </div>
      )}
    </div>
  );
}

export default function DispatchPage({ board }) {
  const { drivers, addDriver, removeDriver, renameDriver, updateDispatch, updateDriverInfo } = board;
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');

  const filtered = drivers.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.dispatch?.status || '').toLowerCase().includes(search.toLowerCase())
  );

  function submit(e) {
    e.preventDefault();
    if (newName.trim()) { addDriver(newName.trim()); setNewName(''); }
  }

  const statusOrder = { READY: 0, DISPATCHED: 1, ENROUTE: 2, RESERVED: 3, HOME: 4, '': 5 };
  const sorted = [...filtered].sort((a, b) =>
    (statusOrder[a.dispatch?.status] ?? 5) - (statusOrder[b.dispatch?.status] ?? 5)
  );

  return (
    <div className="page dispatch-page">
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Dispatch Board</h1>
          <span className="page-subtitle">{drivers.length} drivers</span>
        </div>
        <div className="header-actions">
          <input
            className="search-input"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn-outline" onClick={() => exportDispatchCSV(drivers)}>⬇ Export CSV</button>
          <form onSubmit={submit} className="add-form">
            <input className="add-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Add driver..." />
            <button type="submit" className="btn-primary">+ Add</button>
          </form>
        </div>
      </div>

      {/* Status legend */}
      <div className="status-legend">
        {DISPATCH_STATUSES.map(s => {
          const c = STATUS_CFG[s];
          const count = drivers.filter(d => d.dispatch?.status === s).length;
          return (
            <div key={s} className="legend-item" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
              <strong>{count}</strong> {s}
            </div>
          );
        })}
      </div>

      {/* Dispatch table */}
      <div className="dispatch-scroll">
        <table className="dispatch-table">
          <thead>
            <tr>
              <th className="dth dth-driver">DRIVERS</th>
              <th className="dth">PHONE #</th>
              <th className="dth">TRUCK #</th>
              <th className="dth">TRAILER #</th>
              <th className="dth dth-status">STATUS</th>
              <th className="dth">PICKUP (PU)</th>
              <th className="dth">DELIVERY (DEL)</th>
              <th className="dth">LOAD ID</th>
              <th className="dth">NOTES</th>
              <th className="dth dth-act"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((driver, idx) => {
              const disp = driver.dispatch || {};
              const cfg = STATUS_CFG[disp.status] || {};
              const color = getAvatarColor(driver.name);
              const upd = patch => updateDispatch(driver.id, patch);
              const updInfo = patch => updateDriverInfo(driver.id, patch);
              return (
                <tr
                  key={driver.id}
                  className={`dtr${idx % 2 === 0 ? ' even' : ''}${disp.status ? ` row-${disp.status?.toLowerCase()}` : ''}`}
                >
                  <td className="dtd dtd-driver">
                    <div className="d-info">
                      <div className="d-avatar sm" style={{ background: color }}>{getInitials(driver.name)}</div>
                      <div
                        className="d-name-sm"
                        onClick={() => {
                          const n = prompt('Rename:', driver.name);
                          if (n?.trim()) renameDriver(driver.id, n.trim());
                        }}
                        style={{ cursor: 'pointer' }}
                      >{driver.name}</div>
                    </div>
                  </td>
                  <td className="dtd">
                    <EditCell value={driver.phone} onChange={v => updInfo({ phone: v })} placeholder="Phone #" wide />
                  </td>
                  <td className="dtd dtd-sm">
                    <EditCell value={driver.truck} onChange={v => updInfo({ truck: v })} placeholder="#" />
                  </td>
                  <td className="dtd dtd-sm">
                    <EditCell value={driver.trailer} onChange={v => updInfo({ trailer: v })} placeholder="#" />
                  </td>
                  <td className="dtd dtd-status">
                    <StatusCell value={disp.status} onChange={v => upd({ status: v })} />
                  </td>
                  <td className="dtd">
                    <EditCell value={disp.pu} onChange={v => upd({ pu: v })} placeholder="City, ST" wide />
                  </td>
                  <td className="dtd">
                    <EditCell value={disp.del} onChange={v => upd({ del: v })} placeholder="DEL 00:00 MON · City, ST" wide />
                  </td>
                  <td className="dtd">
                    <EditCell value={disp.loadId} onChange={v => upd({ loadId: v })} placeholder="Load ID" />
                  </td>
                  <td className="dtd">
                    <EditCell value={disp.notes} onChange={v => upd({ notes: v })} placeholder="Notes" wide />
                  </td>
                  <td className="dtd dtd-act">
                    <button className="btn-rm" onClick={() => { if (confirm(`Remove ${driver.name}?`)) removeDriver(driver.id); }}>✕</button>
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
