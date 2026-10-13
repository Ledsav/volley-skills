import { describe, expect, it } from 'vitest';
import { appendOrder, batchOrders, nextOrder, orderAfter, orderAfterValue } from './eventOrder';

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

describe('batchOrders', () => {
  const events = [{ id: 'a', order: 1 }, { id: 'b', order: 2 }, { id: 'c', order: 3 }];
  it('spreads orders strictly between the anchor and the next event', () => {
    const o = batchOrders(events, 'a', 3, 0);
    expect(o).toHaveLength(3);
    expect(o.every((x) => x > 1 && x < 2)).toBe(true);
    expect([...o].sort((x, y) => x - y)).toEqual(o);
  });
  it('appends after the end (and after unsynced writes) without an anchor', () => {
    expect(batchOrders(events, null, 2, 0)).toEqual([4, 5]);
    expect(batchOrders(events, null, 2, 9)).toEqual([10, 11]);
  });
  it('continues after an anchor that is the last event', () => {
    expect(batchOrders(events, 'c', 2, 0)).toEqual([4, 5]);
  });
  it('returns nothing for an empty batch', () => {
    expect(batchOrders(events, 'a', 0, 0)).toEqual([]);
  });
});

describe('batchOrders with an unsynced anchor', () => {
  const events = [{ id: 'a', order: 1 }, { id: 'b', order: 2 }, { id: 'c', order: 3 }];
  it('inserts after the unsynced write that is the anchor', () => {
    const o = batchOrders(events, 'x', 2, 1.5, { id: 'x', order: 1.5 });
    expect(o).toHaveLength(2);
    expect(o.every((x) => x > 1.5 && x < 2)).toBe(true);
    expect([...o].sort((x, y) => x - y)).toEqual(o);
  });
  it('appends after the unsynced anchor when nothing is later', () => {
    expect(batchOrders([{ id: 'a', order: 1 }], 'x', 2, 1.5, { id: 'x', order: 1.5 })).toEqual([2.5, 3.5]);
  });
});
