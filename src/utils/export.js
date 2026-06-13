import { DAYS, calcWeekStats, getEffectivePm } from '../data/initialData';

function download(content, filename, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function esc(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }
function row(cells) { return cells.map(esc).join(','); }

export function exportWeekCSV(drivers, week, weekLabel) {
  const headers = [
    'Driver', 'Truck', 'Trailer', 'Phone',
    ...DAYS.flatMap(d => [`${d} Gross`, `${d} Miles`, `${d} $/mi`, `${d} Notes`, `${d} Status`]),
    'Week Gross', 'Week Miles', 'Avg $/mi', 'Days Worked',
  ];

  const rows = drivers.map(d => {
    const st = calcWeekStats(d[week]);
    const dayData = DAYS.flatMap(day => {
      const c = d[week][day];
      if (c.status !== 'driving') return ['', '', '', c.notes || '', c.status];
      const pm = getEffectivePm(c);
      return [c.dollars ?? '', c.miles ?? '', pm ? pm.toFixed(2) : '', c.notes || '', 'driving'];
    });
    return [
      d.name, d.truck || '', d.trailer || '', d.phone || '',
      ...dayData,
      st.gross.toFixed(2), st.miles, st.pm ? st.pm.toFixed(2) : '', st.days,
    ];
  });

  const csv = [row(headers), ...rows.map(row)].join('\n');
  download(csv, `board-${weekLabel.replace(/\s+/g, '-')}.csv`);
}

export function exportDispatchCSV(drivers) {
  const headers = ['Driver', 'Phone', 'Truck#', 'Trailer#', 'Status', 'Pickup', 'Delivery', 'Load ID', 'Notes'];
  const rows = drivers.map(d => [
    d.name, d.phone || '', d.truck || '', d.trailer || '',
    d.dispatch?.status || '', d.dispatch?.pu || '', d.dispatch?.del || '',
    d.dispatch?.loadId || '', d.dispatch?.notes || '',
  ]);
  const csv = [row(headers), ...rows.map(row)].join('\n');
  download(csv, 'dispatch-board.csv');
}
