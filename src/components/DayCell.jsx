import { useState, useRef, useEffect } from 'react';
import { getEffectivePm } from '../data/initialData';

const fmt$ = n => n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '';

export default function DayCell({ data, onUpdate, threshold }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const ref = useRef(null);

  useEffect(() => { if (open) setDraft({ ...data }); }, [open]);

  useEffect(() => {
    if (!open) return;
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) commit(); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open, draft]);

  function commit() {
    if (draft) onUpdate(draft);
    setOpen(false);
  }

  function setField(field, raw) {
    const val = raw !== '' ? parseFloat(raw) : null;
    setDraft(prev => {
      const next = { ...prev, [field]: val };
      // pm entered + miles → auto-fill dollars
      if (field === 'pm' && val != null && next.miles) next.dollars = parseFloat((val * next.miles).toFixed(2));
      // miles changed + manual pm → auto-fill dollars
      if (field === 'miles' && prev.pm != null && val) next.dollars = parseFloat((prev.pm * val).toFixed(2));
      // dollars entered manually → clear manual pm so it stays auto-calc
      if (field === 'dollars') next.pm = null;
      return next;
    });
  }

  const { status, dollars, miles, notes } = data;
  const effectivePm = getEffectivePm(data);
  const isLow = threshold > 0 && effectivePm != null && effectivePm < threshold;

  const draftPm = draft ? getEffectivePm(draft) : null;
  const isManualPm = draft?.pm != null;

  return (
    <td className={`day-td${isLow ? ' cell-low-pm' : ''}`}>
      <div ref={ref} className="day-cell-wrap">
        <div
          className={`day-cell status-${status}${!dollars && status === 'driving' ? ' empty' : ''}${isLow ? ' low-pm' : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          {status === 'HOME'    && <span className="pill home">🏠 HOME</span>}
          {status === 'TRANSIT' && <span className="pill transit">🔄 TRANSIT</span>}
          {status === 'driving' && (
            dollars
              ? <>
                  <div className="cell-dollars">{fmt$(dollars)}</div>
                  {miles != null && <div className="cell-miles">{Number(miles).toLocaleString()} mi</div>}
                  {effectivePm && <div className={`cell-pm${isLow ? ' pm-warn' : ''}`}>${effectivePm.toFixed(2)}/mi</div>}
                  {notes && <div className="cell-note-dot" title={notes}>●</div>}
                </>
              : <div className="cell-plus">+</div>
          )}
          {isLow && <div className="low-pm-bar" />}
        </div>

        {open && (
          <div className="popover">
            <div className="pop-title">Edit Day</div>
            <div className="pop-statuses">
              {['driving', 'HOME', 'TRANSIT'].map(s => (
                <button
                  key={s}
                  className={`pop-s${draft?.status === s ? ' sel' : ''} pop-s-${s}`}
                  onClick={() => setDraft(d => ({ ...d, status: s }))}
                >
                  {s === 'driving' ? '🚛 Driving' : s === 'HOME' ? '🏠 Home' : '🔄 Transit'}
                </button>
              ))}
            </div>

            {draft?.status === 'driving' && (
              <div className="pop-fields">
                <div className="pop-row-2">
                  <div className="pop-field">
                    <label className="pop-label">Gross ($)</label>
                    <input
                      className="pop-input"
                      type="number"
                      value={draft.dollars ?? ''}
                      onChange={e => setField('dollars', e.target.value)}
                      placeholder="0.00"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false); }}
                    />
                  </div>
                  <div className="pop-field">
                    <label className="pop-label">Miles</label>
                    <input
                      className="pop-input"
                      type="number"
                      value={draft.miles ?? ''}
                      onChange={e => setField('miles', e.target.value)}
                      placeholder="0"
                      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false); }}
                    />
                  </div>
                </div>

                <div className="pop-field">
                  <label className="pop-label">
                    $/mi
                    {isManualPm
                      ? <span className="pm-tag manual">manual</span>
                      : draftPm ? <span className="pm-tag auto">auto</span> : null
                    }
                  </label>
                  <input
                    className={`pop-input${isManualPm ? ' pm-manual-input' : ''}`}
                    type="number"
                    step="0.01"
                    value={draft?.pm ?? (draftPm ? draftPm.toFixed(2) : '')}
                    onChange={e => setField('pm', e.target.value)}
                    placeholder={draftPm ? draftPm.toFixed(2) : 'e.g. 2.50'}
                    onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false); }}
                  />
                  {isManualPm && (
                    <button className="pm-clear" onClick={() => setDraft(d => ({ ...d, pm: null }))}>
                      ✕ clear override
                    </button>
                  )}
                </div>

                {threshold > 0 && draftPm != null && draftPm < threshold && (
                  <div className="pop-warn">⚠ Below ${threshold.toFixed(2)}/mi threshold</div>
                )}

                <div className="pop-field">
                  <label className="pop-label">Notes</label>
                  <textarea
                    className="pop-textarea"
                    value={draft.notes || ''}
                    onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                    placeholder="Load details, issues..."
                    rows={2}
                  />
                </div>
              </div>
            )}

            <div className="pop-actions">
              <button className="pop-cancel" onClick={() => setOpen(false)}>Cancel</button>
              <button className="pop-save" onClick={commit}>✓ Save</button>
            </div>
          </div>
        )}
      </div>
    </td>
  );
}
