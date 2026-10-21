// Pin a DST-observing zone so the DST cases are meaningful on any machine.
process.env.TZ = 'Europe/Madrid';

import { describe, expect, it } from 'vitest';
import { DAY_MS, endOfLocalDay, retrievalLongEnough, startOfLocalDay } from './dates';

const fields = (d: Date) => [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()];

describe('dates', () => {
  it('startOfLocalDay and endOfLocalDay parse YYYY-MM-DD in local time', () => {
    expect(fields(startOfLocalDay('2027-03-05'))).toEqual([2027, 2, 5, 0, 0, 0, 0]);
    expect(fields(endOfLocalDay('2027-03-05'))).toEqual([2027, 2, 5, 23, 59, 59, 999]);
  });

  it('runs in a DST-observing zone', () => {
    expect(new Date(2027, 2, 27).getTimezoneOffset()).not.toBe(new Date(2027, 2, 29).getTimezoneOffset());
    expect(new Date(2027, 9, 30).getTimezoneOffset()).not.toBe(new Date(2027, 10, 1).getTimezoneOffset());
  });

  it('a start date and an end date 30 calendar days later across a DST change are long enough', () => {
    expect(retrievalLongEnough(startOfLocalDay('2027-03-01'), endOfLocalDay('2027-03-31'))).toBe(true);
    expect(retrievalLongEnough(startOfLocalDay('2027-10-01'), endOfLocalDay('2027-10-31'))).toBe(true);
  });

  it.each([
    ['spring-forward 2027-03-28', 'N+29', '2027-03-20', '2027-04-19', '2027-04-18'],
    // Fall-back adds an hour, so N+29 would just pass; the short case is N+28.
    ['fall-back 2027-10-31', 'N+28', '2027-10-20', '2027-11-19', '2027-11-17'],
  ])('straddling %s: day N to end of day N+30 is enough, to end of day %s is not', (_n, _label, start, plus30, short) => {
    expect(retrievalLongEnough(startOfLocalDay(start), endOfLocalDay(plus30))).toBe(true);
    expect(retrievalLongEnough(startOfLocalDay(start), endOfLocalDay(short))).toBe(false);
  });

  it('start of day N to start of day N+30 is short across spring-forward, so retrieval must use endOfLocalDay', () => {
    expect(retrievalLongEnough(startOfLocalDay('2027-03-20'), startOfLocalDay('2027-04-19'))).toBe(false);
    expect(retrievalLongEnough(startOfLocalDay('2027-10-20'), startOfLocalDay('2027-11-19'))).toBe(true);
  });

  it('29 days is not long enough', () => {
    const a = new Date(2027, 0, 1);
    expect(retrievalLongEnough(a, new Date(a.getTime() + 29 * DAY_MS))).toBe(false);
    expect(retrievalLongEnough(a, new Date(a.getTime() + 30 * DAY_MS))).toBe(true);
  });
});
