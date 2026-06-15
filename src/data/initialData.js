export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
export const FLEET_START_DATE = '2026-06-22'; // first Monday

export const DISPATCH_STATUSES = ['READY', 'DISPATCHED', 'ENROUTE', 'RESERVED', 'HOME'];
export const STATUS_CFG = {
  READY:      { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  DISPATCHED: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  ENROUTE:    { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },
  RESERVED:   { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  HOME:       { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
};

// ── Week date utilities ───────────────────────────────────────────
export function getNextWeekKey(mondayDate) {
  const d = new Date(mondayDate + 'T00:00:00');
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

export function getWeekNumber(mondayDate, startDate = FLEET_START_DATE) {
  const start = new Date(startDate + 'T00:00:00');
  const cur   = new Date(mondayDate + 'T00:00:00');
  return Math.max(1, Math.round((cur - start) / (7 * 24 * 60 * 60 * 1000)) + 1);
}

export function getWeekDates(mondayDate) {
  const monday = new Date(mondayDate + 'T00:00:00');
  return DAYS.map((day, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return {
      day,
      num:   d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      full:  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  });
}

export function getWeekDateRange(mondayDate) {
  const dates = getWeekDates(mondayDate);
  return `${dates[0].full} – ${dates[6].full}`;
}

export function getWeekLabel(mondayDate, startDate = FLEET_START_DATE) {
  return `Week ${getWeekNumber(mondayDate, startDate)} · ${getWeekDateRange(mondayDate)}`;
}

// ── Blank data helpers ────────────────────────────────────────────
export function blankDay() {
  return { status: 'driving', dollars: null, miles: null, pm: null, notes: '' };
}
export function blankWeek() {
  const w = {};
  DAYS.forEach(d => { w[d] = blankDay(); });
  return w;
}
export function blankDispatch() {
  return { status: '', phone: '', truck: '', trailer: '', pu: '', del: '', loadId: '', notes: '' };
}

// ── Migration ─────────────────────────────────────────────────────
function migrateDay(c = {}) {
  return { status: c.status || 'driving', dollars: c.dollars ?? null, miles: c.miles ?? null, pm: c.pm ?? null, notes: c.notes || '' };
}
function migrateWeek(week = {}) {
  const r = {};
  DAYS.forEach(d => { r[d] = migrateDay(week[d]); });
  return r;
}

export function migrateDrivers(drivers = []) {
  return drivers.map(d => {
    let weeks = {};
    if (d.weeks && typeof d.weeks === 'object' && !Array.isArray(d.weeks)) {
      Object.entries(d.weeks).forEach(([wk, wkData]) => { weeks[wk] = migrateWeek(wkData); });
    } else {
      // Old weekA/weekB format → map to date keys
      if (d.weekA) weeks[FLEET_START_DATE]                = migrateWeek(d.weekA);
      if (d.weekB) weeks[getNextWeekKey(FLEET_START_DATE)] = migrateWeek(d.weekB);
    }
    const { weekA, weekB, ...rest } = d;
    return { ...rest, truck: d.truck || '', trailer: d.trailer || '', phone: d.phone || '', dispatch: { ...blankDispatch(), ...(d.dispatch || {}) }, weeks };
  });
}

export function migrateMeta(meta = {}) {
  return {
    startDate:   meta.startDate   || FLEET_START_DATE,
    currentWeek: meta.currentWeek || FLEET_START_DATE,
    threshold:   meta.threshold   ?? 2.00,
    darkMode:    meta.darkMode    ?? false,
    history:     meta.history     ?? [],
    year:        meta.year        || 2026,
  };
}

// ── Stats calculators ─────────────────────────────────────────────
export function getEffectivePm(cell) {
  if (cell.pm != null && cell.pm > 0) return cell.pm;
  if (cell.dollars && cell.miles && cell.miles > 0) return cell.dollars / cell.miles;
  return null;
}

export function getMiles(cell) {
  if (cell.miles != null) return cell.miles;
  if (cell.dollars && cell.pm && cell.pm > 0) return cell.dollars / cell.pm;
  return 0;
}

export function calcWeekStats(weekData = {}) {
  let gross = 0, miles = 0, days = 0;
  DAYS.forEach(day => {
    const c = weekData[day];
    if (!c || c.status !== 'driving') return;
    if (c.dollars) { gross += c.dollars; days++; }
    miles += getMiles(c);
  });
  return { gross, miles, days, pm: miles > 0 ? gross / miles : null };
}

export function getDailyTotals(drivers, weekKey) {
  return DAYS.map(day => ({
    day,
    total: drivers.reduce((s, d) => {
      const c = d.weeks?.[weekKey]?.[day];
      return s + (c?.status === 'driving' && c.dollars ? c.dollars : 0);
    }, 0),
  }));
}

export function calcStreak(driver) {
  const weekKeys = Object.keys(driver.weeks || {}).sort();
  const all = [];
  weekKeys.forEach(wk => DAYS.forEach(d => all.push(driver.weeks[wk]?.[d])));
  let last = -1;
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i]?.status === 'driving' && all[i]?.dollars) { last = i; break; }
  }
  if (last === -1) return 0;
  let streak = 0;
  for (let i = last; i >= 0; i--) {
    if (all[i]?.status === 'driving' && all[i]?.dollars) streak++;
    else break;
  }
  return streak;
}

export function getInitials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('');
}
export function getAvatarColor(name) {
  const colors = ['#374151','#1e40af','#065f46','#7c2d12','#4c1d95','#0f4c75','#1f2937','#713f12','#134e4a','#1e3a5f'];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % colors.length;
  return colors[h];
}

export const DEFAULT_DRIVERS = [
  { name: 'MANSUR ELIBOEV',         phone: '',                            truck: '002', trailer: 'PO' },
  { name: 'KHUSAN IBROIMOV',        phone: '513-834-3377',                truck: '006', trailer: 'PO' },
  { name: 'SIROJIDDIN KHAMIDOV',    phone: '(707) 731-9506',              truck: '070', trailer: 'PO' },
  { name: 'SIROJIDDIN GADAYBOYEV',  phone: '5139180508/740-899-0708',     truck: '303', trailer: 'PO' },
  { name: 'HAZRAT KHAN',            phone: '303-883-7728',                truck: '001', trailer: 'PO' },
  { name: 'FARRUKH NURMUKHAMMADOV', phone: '513-224-9999/283-223-2848',   truck: '77',  trailer: 'PO' },
  { name: 'SEVKET EMRE',            phone: '281-253-5413',                truck: '707', trailer: 'PO' },
  { name: 'ABDULKADIR DIS',         phone: '609-949 3914',                truck: '006', trailer: 'PO' },
  { name: 'LOCHIN LUVAYDULLAYEV',   phone: '937-503-0138',                truck: '575', trailer: 'PO' },
  { name: 'NORKHUJA KARSHIBOYEV',   phone: '513 913 1119',                truck: '28',  trailer: 'PO' },
  { name: 'SAIDUSMAN BAKHROMOV',    phone: '513 693 2808/9989945876767',  truck: '770', trailer: 'PO' },
  { name: 'GULOM BAYKAZOV',         phone: '347 472 9795/267 213 2689',   truck: '022', trailer: 'PO' },
  { name: 'SULEYMAN IZCI',          phone: '(609) 509-0286',              truck: '995', trailer: 'PO' },
  { name: 'MANSUR KADIROV',         phone: '(267) 982-7903//408 460 1404',truck: '1975',trailer: 'PO' },
  { name: 'DIOR ABDUHAMIDOV',       phone: '(513) 978-9595',              truck: '777', trailer: 'PO' },
].map((d, i) => ({
  id: i + 1, name: d.name, phone: d.phone, truck: d.truck, trailer: d.trailer,
  dispatch: blankDispatch(), weeks: {},
}));
