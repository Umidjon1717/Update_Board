import { useState, useCallback, useEffect, useRef } from 'react';
import { DEFAULT_DRIVERS, blankWeek, blankDispatch, calcWeekStats, migrateDrivers, migrateMeta, DAYS } from '../data/initialData';
import { initSupabase, isConfigured, setCredentials, clearCredentials } from '../lib/supabase';
import { dbLoad, dbSaveDay, dbSaveDispatch, dbSaveDriverInfo, dbDeleteDriver, dbSaveMeta, dbPushAll, dbSubscribe } from '../lib/db';

const LS_KEY = 'updateboard_v4';

function lsLoad() {
  try { const r = localStorage.getItem(LS_KEY); if (r) return JSON.parse(r); } catch {}
  return null;
}
function lsSave(drivers, meta) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ drivers, meta })); } catch {}
}

export function useBoard() {
  const saved = lsLoad();
  const [drivers, setDrivers] = useState(() => migrateDrivers(saved?.drivers || DEFAULT_DRIVERS));
  const [meta, setMeta]       = useState(() => migrateMeta(saved?.meta));
  // 'local' | 'connecting' | 'connected' | 'error'
  const [dbStatus, setDbStatus] = useState(isConfigured() ? 'connecting' : 'local');

  const lastSaveTs  = useRef(0);
  const unsubRef    = useRef(null);

  // ── Dark mode ─────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!meta.darkMode);
  }, [meta.darkMode]);

  // ── Subscribe helper (shared between init and connectDB) ──────────
  function startSubscription() {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = dbSubscribe(() => {
      // Ignore notifications caused by our own writes (debounce 800ms)
      if (Date.now() - lastSaveTs.current < 800) return;
      dbLoad().then(data => {
        if (!data) return;
        const d = migrateDrivers(data.drivers);
        const m = migrateMeta(data.meta || {});
        setDrivers(d);
        setMeta(m);
        lsSave(d, m);
      }).catch(() => {});
    });
  }

  // ── Init Supabase on mount ────────────────────────────────────────
  useEffect(() => {
    if (!isConfigured()) { setDbStatus('local'); return; }
    initSupabase();
    setDbStatus('connecting');
    dbLoad().then(data => {
      if (!data) { setDbStatus('error'); return; }
      const d = migrateDrivers(data.drivers);
      const m = migrateMeta(data.meta || {});
      setDrivers(d);
      setMeta(m);
      lsSave(d, m);
      setDbStatus('connected');
      startSubscription();
    }).catch(() => setDbStatus('error'));

    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function markSave() { lastSaveTs.current = Date.now(); }

  // ── updateDay ─────────────────────────────────────────────────────
  const updateDay = useCallback((driverId, week, day, patch) => {
    setDrivers(prev => {
      const next = prev.map(d =>
        d.id !== driverId ? d : { ...d, [week]: { ...d[week], [day]: { ...d[week][day], ...patch } } }
      );
      lsSave(next, meta);
      markSave();
      const cell = next.find(d => d.id === driverId)?.[week]?.[day];
      if (cell) dbSaveDay(driverId, week, day, cell).catch(() => {});
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
      if (d) dbSaveDispatch(driverId, d.dispatch).catch(() => {});
      return next;
    });
  }, [meta]);

  // ── addDriver ─────────────────────────────────────────────────────
  const addDriver = useCallback((name) => {
    setDrivers(prev => {
      const id = Math.max(0, ...prev.map(d => d.id)) + 1;
      const newDriver = {
        id, name: name.toUpperCase(), phone: '', truck: '', trailer: '',
        dispatch: blankDispatch(),
        weekA: blankWeek(), weekB: blankWeek(),
      };
      const next = [...prev, newDriver];
      lsSave(next, meta);
      markSave();
      dbSaveDriverInfo(newDriver).catch(() => {});
      return next;
    });
  }, [meta]);

  // ── removeDriver ──────────────────────────────────────────────────
  const removeDriver = useCallback((id) => {
    setDrivers(prev => {
      const next = prev.filter(d => d.id !== id);
      lsSave(next, meta);
      markSave();
      dbDeleteDriver(id).catch(() => {});
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
      if (d) dbSaveDriverInfo(d).catch(() => {});
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
      if (d) dbSaveDriverInfo(d).catch(() => {});
      return next;
    });
  }, [meta]);

  // ── updateMeta ────────────────────────────────────────────────────
  const updateMeta = useCallback((patch) => {
    setMeta(prev => {
      const next = { ...prev, ...patch };
      lsSave(drivers, next);
      markSave();
      dbSaveMeta(next).catch(() => {});
      return next;
    });
  }, [drivers]);

  const toggleDarkMode = useCallback(() => {
    setMeta(prev => {
      const next = { ...prev, darkMode: !prev.darkMode };
      lsSave(drivers, next);
      dbSaveMeta(next).catch(() => {});
      return next;
    });
  }, [drivers]);

  const updateThreshold = useCallback((val) => {
    setMeta(prev => {
      const next = { ...prev, threshold: parseFloat(val) || 0 };
      lsSave(drivers, next);
      dbSaveMeta(next).catch(() => {});
      return next;
    });
  }, [drivers]);

  // ── archiveWeek ───────────────────────────────────────────────────
  const archiveWeek = useCallback((week) => {
    const label = week === 'weekA' ? meta.weekA.label : meta.weekB.label;
    const entry = {
      id: Date.now(),
      label, year: meta.year,
      savedAt: new Date().toISOString(),
      weekKey: week,
      gross: drivers.reduce((s, d) => s + calcWeekStats(d[week]).gross, 0),
      miles: drivers.reduce((s, d) => s + calcWeekStats(d[week]).miles, 0),
      drivers: drivers.map(d => ({
        id: d.id, name: d.name, truck: d.truck,
        week: JSON.parse(JSON.stringify(d[week])),
        stats: calcWeekStats(d[week]),
      })),
    };
    setMeta(prev => {
      const next = { ...prev, history: [entry, ...prev.history] };
      lsSave(drivers, next);
      markSave();
      dbSaveMeta(next).catch(() => {});
      return next;
    });
  }, [drivers, meta]);

  const deleteHistory = useCallback((id) => {
    setMeta(prev => {
      const next = { ...prev, history: prev.history.filter(h => h.id !== id) };
      lsSave(drivers, next);
      markSave();
      dbSaveMeta(next).catch(() => {});
      return next;
    });
  }, [drivers]);

  const getWeekStats = useCallback((week) =>
    drivers.map(d => ({ id: d.id, name: d.name, ...calcWeekStats(d[week]) }))
  , [drivers]);

  // ── connectDB: called from SettingsPage ───────────────────────────
  const connectDB = useCallback(async (url, key) => {
    setCredentials(url, key);
    setDbStatus('connecting');
    try {
      const data = await dbLoad();
      if (!data) throw new Error('Could not reach database');

      const isEmpty = !data.drivers || data.drivers.length === 0;
      if (isEmpty) {
        // Push local data up
        await dbPushAll(drivers, meta);
        setDbStatus('connected');
        startSubscription();
        return { success: true, action: 'pushed' };
      } else {
        // Pull from Supabase
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
    drivers, meta, dbStatus,
    updateDay, updateDispatch,
    addDriver, removeDriver, renameDriver, updateDriverInfo,
    updateMeta, toggleDarkMode, updateThreshold,
    archiveWeek, deleteHistory,
    getWeekStats, DAYS,
    connectDB, disconnectDB,
  };
}
