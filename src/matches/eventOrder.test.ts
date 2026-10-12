import { describe, expect, it } from 'vitest';
import { appendOrder, orderAfter } from './eventOrder';

describe('eventOrder', () => {
  it('appends after the highest order', () => {
    expect(appendOrder([])).toBe(1);
    expect(appendOrder([{ order: 3 }, { order: 7 }])).toBe(8);
  });

  it('inserts at the midpoint after an anchor', () => {
    const events = [{ id: 'a', order: 1 }, { id: 'b', order: 2 }, { id: 'c', order: 3 }];
    expect(orderAfter(events, 'a')).toBe(1.5);
    expect(orderAfter(events, 'c')).toBe(4);
    expect(orderAfter(events, 'missing')).toBe(4);
  });
});
