import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  DEFAULT_DRIVERS, blankDay, blankWeek, blankDispatch,
  migrateDrivers, migrateMeta, getRealCurrentWeekKey, getNextWeekKey, DAYS,
} from '../data/initialData';
import { initSupabase, isConfigured, setCredentials, clearCredentials } from '../lib/supabase';
import { dbLoad, dbSaveDay, dbSaveDispatch, dbSaveDriverInfo, dbDeleteDriver, dbSaveMeta, dbPushAll, dbSubscribe } from '../lib/db';

function logFail(action) {
  return err => console.error(`[UpdateBoard] ${action} failed:`, err);
}

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

  // The current week is never stored — it's always derived fresh from the
  // real calendar date. That way a stale or incorrectly-saved value can
  // never survive a reload, a Supabase sync, or anything else: there's
  // nothing to go stale.
  const currentWeek = getRealCurrentWeekKey(meta.startDate);

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

  // Every week from the fleet's start through currentWeek (the real, calendar-
  // driven "this week"), plus any week beyond that someone has actually
  // started entering data for (pre-planning a future week). This is a
  // contiguous range, not just weeks that happen to have data, so "<-"/"->"
  // always move exactly one week and a manager can always browse back to an
  // empty past week to fill in something missed.
  const allWeekKeys = useMemo(() => {
    const keys = [];
    let cursor = meta.startDate;
    let guard = 0;
    while (cursor <= currentWeek && guard < 1000) {
      keys.push(cursor);
      cursor = getNextWeekKey(cursor);
      guard++;
    }
    // Fold in any week with real data that falls outside that range (future
    // weeks someone started filling in ahead of time, or legacy data).
    drivers.forEach(d => Object.keys(d.weeks || {}).forEach(k => {
      if (!keys.includes(k)) keys.push(k);
    }));
    return keys.sort();
  }, [drivers, meta.startDate, currentWeek]);

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

  // Every page lists drivers alphabetically — sort once here rather than in
  // each page, so Board/Drivers/Dispatch always agree on the order.
  const sortedDrivers = useMemo(() => (
    [...drivers].sort((a, b) => a.name.localeCompare(b.name))
  ), [drivers]);

  return {
    drivers: sortedDrivers, meta, dbStatus, allWeekKeys, currentWeek,
    updateDay, updateDispatch,
    addDriver, removeDriver, renameDriver, updateDriverInfo,
    updateMeta, toggleDarkMode,
    DAYS,
    connectDB, disconnectDB,
  };
}
