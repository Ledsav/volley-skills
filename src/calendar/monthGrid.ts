import { todayLocalIso } from '../dates/today';
import { formatMonth, monthNames, weekdayNames } from '../i18n/format';

function isoOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

export function monthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return { start: isoOf(start), end: isoOf(end) };
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const base = new Date(Date.UTC(year, month + delta, 1));
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() };
}

export function formatMonthLabel(year: number, month: number): string {
  return formatMonth(year, month);
}

/** "2026-09-15" → "Tuesday 15 September". */
export function formatDayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${weekdayNames('long')[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} ${monthNames()[d.getUTCMonth()]}`;
}

/** Today's date as an ISO "YYYY-MM-DD" string, in the viewer's local timezone
 *  (grid cell dates represent local calendar days, not UTC ones). */
export function todayIso(): string {
  return todayLocalIso();
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
      week.push({ date: isoOf(cell), inMonth: cell.getUTCMonth() === month });
    }
    grid.push(week);
  }
  return grid;
}

/** Moves an ISO date by whole days (UTC arithmetic, like the grid). */
export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoOf(d);
}
