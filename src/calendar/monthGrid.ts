const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

export function monthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return { start: iso(start), end: iso(end) };
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const base = new Date(Date.UTC(year, month + delta, 1));
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() };
}

export function formatMonthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

export function buildMonthGrid(year: number, month: number): { date: string; inMonth: boolean }[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeks = Math.ceil((mondayOffset + daysInMonth) / 7);

  const grid: { date: string; inMonth: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: { date: string; inMonth: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(Date.UTC(year, month, 1 - mondayOffset + w * 7 + d));
      week.push({ date: iso(cell), inMonth: cell.getUTCMonth() === month });
    }
    grid.push(week);
  }
  return grid;
}
