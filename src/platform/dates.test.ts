import { describe, expect, it } from 'vitest';
import { DAY_MS, endOfLocalDay, retrievalLongEnough, startOfLocalDay } from './dates';

const fields = (d: Date) => [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()];

describe('dates', () => {
  it('startOfLocalDay and endOfLocalDay parse YYYY-MM-DD in local time', () => {
    expect(fields(startOfLocalDay('2027-03-05'))).toEqual([2027, 2, 5, 0, 0, 0, 0]);
    expect(fields(endOfLocalDay('2027-03-05'))).toEqual([2027, 2, 5, 23, 59, 59, 999]);
  });

  it('a start date and an end date 30 calendar days later across a DST change are long enough', () => {
    expect(retrievalLongEnough(startOfLocalDay('2027-03-01'), endOfLocalDay('2027-03-31'))).toBe(true);
    expect(retrievalLongEnough(startOfLocalDay('2027-10-01'), endOfLocalDay('2027-10-31'))).toBe(true);
  });

  it('29 days is not long enough', () => {
    const a = new Date(2027, 0, 1);
    expect(retrievalLongEnough(a, new Date(a.getTime() + 29 * DAY_MS))).toBe(false);
    expect(retrievalLongEnough(a, new Date(a.getTime() + 30 * DAY_MS))).toBe(true);
  });
});
