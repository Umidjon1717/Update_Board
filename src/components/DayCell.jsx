import { useState, useRef, useEffect } from 'react';
import { getMiles } from '../data/initialData';

const fmt$ = n => n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '';

export default function DayCell({ data, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const ref = useRef(null);

  // Only (re)seed the draft when the popover actually opens — NOT on every
  // change to `data`. For an empty cell, the parent passes a brand-new
  // blankDay() object on every render, so depending on `data` here meant any
  // unrelated re-render (e.g. a Supabase realtime sync from another tab/
  // device) would silently reset whatever the user was mid-typing.
  useEffect(() => { if (open) setDraft({ ...data }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function setGross(raw) {
    const dollars = raw !== '' ? parseFloat(raw) : null;
    setDraft(prev => {
      const pm = prev.pm;
      const miles = dollars && pm && pm > 0 ? parseFloat((dollars / pm).toFixed(1)) : null;
      return { ...prev, dollars, miles };
    });
  }

  function setPm(raw) {
    const pm = raw !== '' ? parseFloat(raw) : null;
    setDraft(prev => {
      const dollars = prev.dollars;
      const miles = dollars && pm && pm > 0 ? parseFloat((dollars / pm).toFixed(1)) : null;
      return { ...prev, pm, miles };
    });
  }

  const { status, dollars, pm, notes } = data;
  const miles = getMiles(data);
  const displayPm = pm ?? (miles > 0 && dollars ? dollars / miles : null);

  return (
    <td className="day-td">
      <div ref={ref} className="day-cell-wrap">
        <div
          className={`day-cell status-${status}${!dollars && status === 'driving' ? ' empty' : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          {status === 'HOME'    && <span className="pill home">🏠 HOME</span>}
          {status === 'TRANSIT' && <span className="pill transit">🔄 TRANSIT</span>}
          {status === 'driving' && (
            dollars
              ? <>
                  <div className="cell-dollars">{fmt$(dollars)}</div>
                  {miles > 0 && <div className="cell-miles">{Number(miles).toLocaleString(undefined, { maximumFractionDigits: 0 })} mi</div>}
                  {displayPm && <div className="cell-pm">${displayPm.toFixed(2)}/mi</div>}
                  {notes && <div className="cell-note-dot" title={notes}>●</div>}
                </>
              : <div className="cell-plus">+</div>
          )}
        </div>

        {open && draft && (
          <div className="popover">
            <div className="pop-title">Edit Day</div>
            <div className="pop-statuses">
              {['driving', 'HOME', 'TRANSIT'].map(s => (
                <button
                  key={s}
                  className={`pop-s${draft.status === s ? ' sel' : ''} pop-s-${s}`}
                  onClick={() => setDraft(d => ({ ...d, status: s }))}
                >
                  {s === 'driving' ? '🚛 Driving' : s === 'HOME' ? '🏠 Home' : '🔄 Transit'}
                </button>
              ))}
            </div>

            {draft.status === 'driving' && (
              <div className="pop-fields">
                <div className="pop-field">
                  <label className="pop-label">Gross ($)</label>
                  <input
                    className="pop-input"
                    type="number"
                    value={draft.dollars ?? ''}
                    onChange={e => setGross(e.target.value)}
                    placeholder="0"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false); }}
                  />
                </div>
                <div className="pop-field">
                  <label className="pop-label">$/mi Rate</label>
                  <input
                    className="pop-input"
                    type="number"
                    step="0.01"
                    value={draft.pm ?? ''}
                    onChange={e => setPm(e.target.value)}
                    placeholder="e.g. 2.50"
                    onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false); }}
                  />
                </div>

                {draft.dollars && draft.pm && draft.pm > 0 && (
                  <div className="pop-calc-miles">
                    Miles: <strong>{(draft.dollars / draft.pm).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                    <span className="pop-calc-note"> (auto)</span>
                  </div>
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
