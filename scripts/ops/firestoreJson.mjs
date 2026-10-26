// Firestore document data <-> plain JSON for backups (backup design §3.2). Special types
// become tagged objects so a restore writes back the same types, not plain maps.
import { DocumentReference, GeoPoint, Timestamp } from 'firebase-admin/firestore';

const TAG = '__fs';

const isPlainObject = (v) => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/** `data` as JSON-safe values with Timestamp, GeoPoint, DocumentReference and bytes tagged. */
export function encodeData(value) {
  if (value instanceof Timestamp) return { [TAG]: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof GeoPoint) return { [TAG]: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return { [TAG]: 'ref', path: value.path };
  if (ArrayBuffer.isView(value)) return { [TAG]: 'bytes', base64: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') };
  if (typeof value === 'number' && !Number.isFinite(value)) return { [TAG]: 'double', value: String(value) };
  if (Array.isArray(value)) return value.map(encodeData);
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = encodeData(v);
    return TAG in value ? { [TAG]: 'map', value: out } : out;
  }
  // A class this file does not know (e.g. a vector value) would come back as a plain map.
  if (typeof value === 'object' && value !== null) throw new Error(`Unsupported Firestore value: ${value.constructor?.name ?? 'object'}.`);
  return value;
}

/** The inverse of encodeData; references are rebuilt on `db`. */
export function decodeData(value, db) {
  if (Array.isArray(value)) return value.map((v) => decodeData(v, db));
  if (!isPlainObject(value)) return value;
  switch (value[TAG]) {
    case 'timestamp':
      return new Timestamp(value.seconds, value.nanoseconds);
    case 'geopoint':
      return new GeoPoint(value.latitude, value.longitude);
    case 'ref':
      return db.doc(value.path);
    case 'double':
      return Number(value.value);
    case 'bytes':
      return Buffer.from(value.base64, 'base64');
    case 'map':
      return decodeMap(value.value, db);
    default:
      return decodeMap(value, db);
  }
}

function decodeMap(map, db) {
  const out = {};
  for (const [k, v] of Object.entries(map)) out[k] = decodeData(v, db);
  return out;
}
