// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { initializeApp } from 'firebase-admin/app';
import { DocumentReference, GeoPoint, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { decodeData, encodeData } from './firestoreJson.mjs';

// Building references needs a Firestore instance, not a server.
const db = getFirestore(initializeApp({ projectId: 'encode-test' }, 'encode-test'));
const roundTrip = (data) => decodeData(JSON.parse(JSON.stringify(encodeData(data))), db);

describe('encodeData / decodeData', () => {
  it('keeps timestamps as Timestamps', () => {
    const at = new Timestamp(1_760_000_000, 123_000_000);
    const back = roundTrip({ at });
    expect(back.at).toBeInstanceOf(Timestamp);
    expect(back.at.isEqual(at)).toBe(true);
  });

  it('keeps geopoints, references and bytes', () => {
    const back = roundTrip({ where: new GeoPoint(45.5, 9.2), ref: db.doc('clubs/demo/teams/t1'), raw: Buffer.from([0, 1, 255]) });
    expect(back.where).toBeInstanceOf(GeoPoint);
    expect(back.where.isEqual(new GeoPoint(45.5, 9.2))).toBe(true);
    expect(back.ref).toBeInstanceOf(DocumentReference);
    expect(back.ref.path).toBe('clubs/demo/teams/t1');
    expect(Buffer.isBuffer(back.raw)).toBe(true);
    expect([...back.raw]).toEqual([0, 1, 255]);
  });

  it('keeps nested arrays of maps, nulls and plain values', () => {
    const at = new Timestamp(1, 0);
    const data = { n: 3, s: 'x', b: false, nil: null, list: [{ at, tags: ['a', 'b'] }, [1, 2]], map: { deep: { at } } };
    const back = roundTrip(data);
    expect(back.list[0].at.isEqual(at)).toBe(true);
    expect(back.map.deep.at.isEqual(at)).toBe(true);
    expect({ ...back, list: [{ ...back.list[0], at: 't' }, back.list[1]], map: { deep: { at: 't' } } }).toEqual({
      ...data,
      list: [{ at: 't', tags: ['a', 'b'] }, [1, 2]],
      map: { deep: { at: 't' } },
    });
  });

  it('keeps a real map whose key happens to be __fs', () => {
    const data = { odd: { __fs: 'timestamp', seconds: 5 } };
    expect(roundTrip(data)).toEqual(data);
  });

  it('produces plain JSON', () => {
    const json = encodeData({ at: new Timestamp(10, 0) });
    expect(json).toEqual({ at: { __fs: 'timestamp', seconds: 10, nanoseconds: 0 } });
  });

  it('keeps NaN and infinities, which JSON would turn into null', () => {
    const back = roundTrip({ a: Number.NaN, b: Number.POSITIVE_INFINITY, c: Number.NEGATIVE_INFINITY, d: 1.5 });
    expect(Number.isNaN(back.a)).toBe(true);
    expect(back.b).toBe(Number.POSITIVE_INFINITY);
    expect(back.c).toBe(Number.NEGATIVE_INFINITY);
    expect(back.d).toBe(1.5);
  });

  it('refuses a value of a type it does not know, instead of saving it as a map', () => {
    class Unknown {
      constructor() {
        this.x = 1;
      }
    }
    expect(() => encodeData({ v: new Unknown() })).toThrow(/Unsupported Firestore value/);
  });
});
