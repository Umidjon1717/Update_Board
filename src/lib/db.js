import { getClient } from './supabase';
import { DAYS, FLEET_START_DATE, blankDay, blankDispatch } from '../data/initialData';

// ── Reconstruct driver objects from flat DB rows ─────────────────
function buildAllWeeks(driverDays) {
  const weekKeys = [...new Set(driverDays.map(x => x.week))];
  const result = {};
  weekKeys.forEach(wk => {
    result[wk] = {};
    DAYS.forEach(day => {
      const e = driverDays.find(x => x.week === wk && x.day === day);
      result[wk][day] = e
        ? { status: e.status || 'driving', dollars: e.dollars ?? null, miles: e.miles ?? null, pm: e.pm ?? null, notes: e.notes || '' }
        : blankDay();
    });
  });
  return result;
}

export function buildDrivers(rawDrivers, rawDispatch, rawDays) {
  // Postgres bigint columns are serialized as strings by PostgREST — normalize to Number
  // so ids compare consistently with locally-generated (numeric) driver ids.
  return rawDrivers.map(d => {
    const id    = Number(d.id);
    const disp  = rawDispatch.find(r => Number(r.driver_id) === id) || {};
    const ddays = rawDays.filter(r => Number(r.driver_id) === id);
    return {
      id,
      name:    d.name,
      phone:   d.phone   || '',
      truck:   d.truck   || '',
      trailer: d.trailer || '',
      dispatch: { ...blankDispatch(), status: disp.status || '', pu: disp.pu || '', del: disp.del_info || '', loadId: disp.load_id || '', notes: disp.notes || '' },
      weeks:   buildAllWeeks(ddays),
    };
  });
}

export function buildMetaFromDB(row) {
  if (!row) return null;
  const wa = row.week_a || {};
  return {
    startDate: wa.startDate  || FLEET_START_DATE,
    darkMode:  row.dark_mode ?? false,
    year:      row.year      || 2026,
  };
}

// ── Load all data from Supabase ──────────────────────────────────
export async function dbLoad() {
  const sb = getClient();
  if (!sb) return null;
  const [drRes, diRes, dayRes, metaRes] = await Promise.all([
    sb.from('ub_drivers').select('*').order('sort_order,id'),
    sb.from('ub_dispatch').select('*'),
    sb.from('ub_week_days').select('*'),
    sb.from('ub_meta').select('*').eq('id', 1).maybeSingle(),
  ]);
  if (drRes.error) throw drRes.error;
  return {
    drivers: buildDrivers(drRes.data || [], diRes.data || [], dayRes.data || []),
    meta:    buildMetaFromDB(metaRes.data),
  };
}

// ── Individual save operations ───────────────────────────────────
export async function dbSaveDay(driverId, week, day, data) {
  const sb = getClient(); if (!sb) return;
  await sb.from('ub_week_days').upsert({
    driver_id: driverId, week, day,
    status: data.status, dollars: data.dollars, miles: data.miles, pm: data.pm, notes: data.notes || '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'driver_id,week,day' });
}

export async function dbSaveDispatch(driverId, dispatch) {
  const sb = getClient(); if (!sb) return;
  await sb.from('ub_dispatch').upsert({
    driver_id: driverId,
    status: dispatch.status || '', pu: dispatch.pu || '', del_info: dispatch.del || '',
    load_id: dispatch.loadId || '', notes: dispatch.notes || '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'driver_id' });
}

export async function dbSaveDriverInfo(driver) {
  const sb = getClient(); if (!sb) return;
  await sb.from('ub_drivers').upsert({
    id: driver.id, name: driver.name,
    phone: driver.phone || '', truck: driver.truck || '', trailer: driver.trailer || '',
    sort_order: driver.id,
  }, { onConflict: 'id' });
  if (driver.dispatch) await dbSaveDispatch(driver.id, driver.dispatch);
}

export async function dbDeleteDriver(id) {
  const sb = getClient(); if (!sb) return;
  await sb.from('ub_drivers').delete().eq('id', id);
}

export async function dbSaveMeta(meta) {
  const sb = getClient(); if (!sb) return;
  await sb.from('ub_meta').upsert({
    id: 1,
    year: meta.year || 2026,
    week_a: { startDate: meta.startDate },
    week_b: {},
    dark_mode: meta.darkMode,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
}

// ── Bulk push local state to Supabase (first-time migration) ─────
export async function dbPushAll(drivers, meta) {
  const sb = getClient(); if (!sb) return;
  for (const d of drivers) {
    await sb.from('ub_drivers').upsert({ id: d.id, name: d.name, phone: d.phone || '', truck: d.truck || '', trailer: d.trailer || '', sort_order: d.id }, { onConflict: 'id' });
    await sb.from('ub_dispatch').upsert({ driver_id: d.id, status: d.dispatch?.status || '', pu: d.dispatch?.pu || '', del_info: d.dispatch?.del || '', load_id: d.dispatch?.loadId || '', notes: d.dispatch?.notes || '' }, { onConflict: 'driver_id' });
    for (const [weekKey, weekData] of Object.entries(d.weeks || {})) {
      for (const day of DAYS) {
        const cell = weekData[day];
        if (!cell) continue;
        await sb.from('ub_week_days').upsert({ driver_id: d.id, week: weekKey, day, status: cell.status || 'driving', dollars: cell.dollars ?? null, miles: cell.miles ?? null, pm: cell.pm ?? null, notes: cell.notes || '' }, { onConflict: 'driver_id,week,day' });
      }
    }
  }
  await dbSaveMeta(meta);
}

// ── Real-time subscription ────────────────────────────────────────
export function dbSubscribe(onAnyChange) {
  const sb = getClient(); if (!sb) return () => {};
  const channel = sb.channel('ub-board')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ub_drivers' },   onAnyChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ub_dispatch' },  onAnyChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ub_week_days' }, onAnyChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ub_meta' },      onAnyChange)
    .subscribe();
  return () => sb.removeChannel(channel);
}
