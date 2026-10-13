import { describe, expect, it } from 'vitest';
import { appendOrder, nextOrder, orderAfter, orderAfterValue } from './eventOrder';

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

  it('inserts after a raw order value', () => {
    const events = [{ id: 'a', order: 1 }, { id: 'b', order: 2 }];
    expect(orderAfterValue(events, 1.5)).toBe(1.75);
    expect(orderAfterValue(events, 2)).toBe(3);
  });

  describe('nextOrder', () => {
    const events = [{ id: 'a', order: 1 }, { id: 'b', order: 2 }, { id: 'c', order: 3 }];

    it('never reuses an order written before the snapshot caught up', () => {
      expect(nextOrder(events, null, null, 0)).toBe(4);
      expect(nextOrder(events, null, { id: 'x', order: 4 }, 4)).toBe(5);
    });

    it('inserts after a known anchor', () => {
      expect(nextOrder(events, 'a', null, 3)).toBe(1.5);
    });

    it('inserts after the last write when the anchor is that unsynced write', () => {
      expect(nextOrder(events, 'x', { id: 'x', order: 1.5 }, 3)).toBe(1.75);
    });

    it('appends when the anchor is unknown', () => {
      expect(nextOrder(events, 'gone', { id: 'x', order: 1.5 }, 3)).toBe(4);
    });
  });
});
