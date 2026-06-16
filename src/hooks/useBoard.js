import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  DEFAULT_DRIVERS, blankDay, blankWeek, blankDispatch,
  migrateDrivers, migrateMeta, getRealCurrentWeekKey, DAYS,
} from '../data/initialData';

function logFail(action) {
  return err => console.error(`[UpdateBoard] ${action} failed:`, err);
}
import { initSupabase, isConfigured, setCredentials, clearCredentials } from '../lib/supabase';
import { dbLoad, dbSaveDay, dbSaveDispatch, dbSaveDriverInfo, dbDeleteDriver, dbSaveMeta, dbPushAll, dbSubscribe } from '../lib/db';

const LS_KEY = 'updateboard_v5';

function lsLoad() {
  try {
    const r = localStorage.getItem(LS_KEY);
    if (r) return JSON.parse(r);
    // Try migrating from v4
    const old = localStorage.getItem('updateboard_v4');
    if (old) return JSON.parse(old);
  } catch {}
  return null;
}
function lsSave(drivers, meta) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ drivers, meta })); } catch {}
}

export function useBoard() {
  const saved = lsLoad();
  const [drivers, setDrivers] = useState(() => migrateDrivers(saved?.drivers || DEFAULT_DRIVERS));
  const [meta, setMeta]       = useState(() => migrateMeta(saved?.meta));
  const [dbStatus, setDbStatus] = useState(isConfigured() ? 'connecting' : 'local');

  const lastSaveTs = useRef(0);
  const unsubRef   = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!meta.darkMode);
  }, [meta.darkMode]);

  function startSubscription() {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = dbSubscribe(() => {
      if (Date.now() - lastSaveTs.current < 2000) return;
      dbLoad().then(data => {
        if (!data) return;
        const d = migrateDrivers(data.drivers);
        const m = migrateMeta(data.meta || {});
        setDrivers(d);
        setMeta(m);
        lsSave(d, m);
      }).catch(logFail('realtime reload'));
    });
  }

  useEffect(() => {
    if (!isConfigured()) { setDbStatus('local'); return; }
    initSupabase();
    setDbStatus('connecting');
    dbLoad().then(data => {
      if (!data) { setDbStatus('error'); return; }
      const rawDrivers = data.drivers || [];
      // Detect old 'weekA'/'weekB' keys in the DB — need to push migrated data back
      const hadOldKeys = rawDrivers.some(dr =>
        Object.keys(dr.weeks || {}).some(k => k === 'weekA' || k === 'weekB')
      );
      const d = migrateDrivers(rawDrivers);
      const m = migrateMeta(data.meta || {});
      setDrivers(d);
      setMeta(m);
      lsSave(d, m);
      setDbStatus('connected');
      if (hadOldKeys) {
        // Re-push migrated data to fix the DB week keys
        dbPushAll(d, m).catch(logFail('week-key migration push'));
      }
      startSubscription();
    }).catch(err => { console.error('[UpdateBoard] initial Supabase load failed:', err); setDbStatus('error'); });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function markSave() { lastSaveTs.current = Date.now(); }

  // ── Auto-advance to the real current week (US Eastern Time) ───────
  // No one has to click "next week" for the board to be on the right week —
  // the moment a new calendar week actually starts, this catches it up.
  // Only ever moves forward; never reverts manual navigation into the future.
  const driversRef = useRef(drivers);
  useEffect(() => { driversRef.current = drivers; }, [drivers]);
  useEffect(() => {
    const real = getRealCurrentWeekKey(meta.startDate);
    if (real > meta.currentWeek) {
      setMeta(prev => {
        if (real <= prev.currentWeek) return prev;
        const next = { ...prev, currentWeek: real };
        lsSave(driversRef.current, next);
        markSave();
        dbSaveMeta(next).catch(logFail('auto week-advance sync'));
        return next;
      });
    }
  }, [meta.startDate, meta.currentWeek]);

  // All week keys that have data (plus currentWeek)
  const allWeekKeys = useMemo(() => {
    const set = new Set();
    drivers.forEach(d => Object.keys(d.weeks || {}).forEach(k => set.add(k)));
    set.add(meta.currentWeek);
    return [...set].sort();
  }, [drivers, meta.currentWeek]);

  // ── updateDay ─────────────────────────────────────────────────────
  const updateDay = useCallback((driverId, weekKey, day, patch) => {
    setDrivers(prev => {
      const next = prev.map(d => {
        if (d.id !== driverId) return d;
        const existingWeek = d.weeks[weekKey] || blankWeek();
        const existingDay  = existingWeek[day]  || blankDay();
        return {
          ...d,
          weeks: { ...d.weeks, [weekKey]: { ...existingWeek, [day]: { ...existingDay, ...patch } } },
        };
      });
      lsSave(next, meta);
      markSave();
      const cell = next.find(d => d.id === driverId)?.weeks?.[weekKey]?.[day];
      if (cell) dbSaveDay(driverId, weekKey, day, cell).then(markSave).catch(logFail('save day'));
      return next;
    });
  }, [meta]);

  // ── updateDispatch ────────────────────────────────────────────────
  const updateDispatch = useCallback((driverId, patch) => {
    setDrivers(prev => {
      const next = prev.map(d =>
        d.id !== driverId ? d : { ...d, dispatch: { ...d.dispatch, ...patch } }
      );
      lsSave(next, meta);
      markSave();
      const d = next.find(d => d.id === driverId);
      if (d) dbSaveDispatch(driverId, d.dispatch).then(markSave).catch(logFail('save dispatch'));
      return next;
    });
  }, [meta]);

  // ── addDriver ─────────────────────────────────────────────────────
  const addDriver = useCallback((name) => {
    setDrivers(prev => {
      const id = Math.max(0, ...prev.map(d => Number(d.id) || 0)) + 1;
      const newDriver = {
        id, name: name.toUpperCase(), phone: '', truck: '', trailer: '',
        dispatch: blankDispatch(),
        weeks: {},
      };
      const next = [...prev, newDriver];
      lsSave(next, meta);
      markSave();
      dbSaveDriverInfo(newDriver).then(markSave).catch(logFail('add driver'));
      return next;
    });
  }, [meta]);

  // ── removeDriver ──────────────────────────────────────────────────
  const removeDriver = useCallback((id) => {
    setDrivers(prev => {
      const next = prev.filter(d => d.id !== id);
      lsSave(next, meta);
      markSave();
      dbDeleteDriver(id).then(markSave).catch(logFail('remove driver'));
      return next;
    });
  }, [meta]);

  // ── renameDriver ──────────────────────────────────────────────────
  const renameDriver = useCallback((id, name) => {
    setDrivers(prev => {
      const next = prev.map(d => d.id === id ? { ...d, name: name.toUpperCase() } : d);
      lsSave(next, meta);
      markSave();
      const d = next.find(d => d.id === id);
      if (d) dbSaveDriverInfo(d).then(markSave).catch(logFail('rename driver'));
      return next;
    });
  }, [meta]);

  // ── updateDriverInfo ──────────────────────────────────────────────
  const updateDriverInfo = useCallback((id, patch) => {
    setDrivers(prev => {
      const next = prev.map(d => d.id === id ? { ...d, ...patch } : d);
      lsSave(next, meta);
      markSave();
      const d = next.find(d => d.id === id);
      if (d) dbSaveDriverInfo(d).then(markSave).catch(logFail('update driver info'));
      return next;
    });
  }, [meta]);

  // ── updateMeta ────────────────────────────────────────────────────
  const updateMeta = useCallback((patch) => {
    setMeta(prev => {
      const next = { ...prev, ...patch };
      lsSave(drivers, next);
      markSave();
      dbSaveMeta(next).catch(logFail('update meta'));
      return next;
    });
  }, [drivers]);

  const toggleDarkMode = useCallback(() => {
    setMeta(prev => {
      const next = { ...prev, darkMode: !prev.darkMode };
      lsSave(drivers, next);
      dbSaveMeta(next).catch(logFail('toggle dark mode'));
      return next;
    });
  }, [drivers]);

  // ── goToWeek: navigate to (and, if new, create) any week ──────────
  // Weeks need no explicit "close" step — every week's data lives under its
  // own date key permanently, so moving forward just extends currentWeek.
  const goToWeek = useCallback((weekKey) => {
    setMeta(prev => {
      if (weekKey <= prev.currentWeek) return prev; // not a new frontier — no meta change needed
      const next = { ...prev, currentWeek: weekKey };
      lsSave(drivers, next);
      markSave();
      dbSaveMeta(next).catch(logFail('go to week'));
      return next;
    });
  }, [drivers]);

  // ── connectDB ─────────────────────────────────────────────────────
  const connectDB = useCallback(async (url, key) => {
    setCredentials(url, key);
    setDbStatus('connecting');
    try {
      const data = await dbLoad();
      if (!data) throw new Error('Could not reach database');
      const isEmpty = !data.drivers || data.drivers.length === 0;
      if (isEmpty) {
        await dbPushAll(drivers, meta);
        setDbStatus('connected');
        startSubscription();
        return { success: true, action: 'pushed' };
      } else {
        const d = migrateDrivers(data.drivers);
        const m = migrateMeta(data.meta || {});
        setDrivers(d);
        setMeta(m);
        lsSave(d, m);
        setDbStatus('connected');
        startSubscription();
        return { success: true, action: 'pulled' };
      }
    } catch (e) {
      clearCredentials();
      setDbStatus('local');
      return { success: false, error: e.message };
    }
  }, [drivers, meta]); // eslint-disable-line react-hooks/exhaustive-deps

  const disconnectDB = useCallback(() => {
    clearCredentials();
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    setDbStatus('local');
  }, []);

  return {
    drivers, meta, dbStatus, allWeekKeys,
    updateDay, updateDispatch,
    addDriver, removeDriver, renameDriver, updateDriverInfo,
    updateMeta, toggleDarkMode, goToWeek,
    DAYS,
    connectDB, disconnectDB,
  };
}
