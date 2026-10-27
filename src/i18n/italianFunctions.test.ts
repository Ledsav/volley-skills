import { describe, expect, it } from 'vitest';
import { it as itCatalog } from './it';
import type { Gender } from './catalog';

// Approach: catalog functions take unknown params (counts, genders, names, dates, ...), so each
// function is tried with a small set of argument tuples (numbers 0/1/2 as n and as pairs, each
// Gender, sample strings, mixed shapes). A function passes when at least one tuple yields a
// clean, non-empty string without "undefined", "NaN" or "[object" (wrong-typed tuples print "undefined" by construction, so only a function with no clean tuple fails); a tuple that throws, or has fewer arguments than fn.length, is skipped.
const GENDERS: Gender[] = ['women', 'men', 'mixed'];
const BAD = /undefined|NaN|\[object/;

function tuples(): unknown[][] {
  const out: unknown[][] = [[]];
  const strs = ['Giulia Rossi', '2026-10-27'];
  for (const n of [0, 1, 2]) {
    out.push([n], [n, n], [n, 3], [n, 'Giulia Rossi']);
    for (const g of GENDERS) out.push([n, g], [g], [g, n]);
  }
  for (const s of strs) {
    out.push([s], [s, s], [s, 2], [2, s]);
    for (const g of GENDERS) out.push([s, g], [g, s]);
  }
  // Composite shapes: line-number lists, jersey lists, booleans, score lines, side pairs.
  for (const list of [[], [3], [3, 9, 12]]) out.push([list], [2, list], ['S', '#', list], ['unmapped', 7, list], ['decided', 7, list]);
  out.push(['S', 'Giulia', 'Rossi'], ['OH', 2, 1], ['MB', 0, 1], [2, 'us', 10, 12, 1, 2], [1, 3, 25, 20, 2, 1, true], [true, 10, 12, '2', 3, false], [false, 0, 1, 2, 1, true]);
  out.push([10, 12, '5', '6'], ['5%', '4', '3', 2, 1], ['5%', '4', '3', 2, null], [2, 10, 12, 1, 25, 'Avversari'], ['us', 'them'], ['them', 'us'], [['a', 'b']], [[]]);
  out.push(['us'], ['them'], ['us', 'oppError'], ['them', null], ['S'], ['A', '#'], [7, 'S', '#'], [7, 9], [1, 2, 3], ['Giulia', 'Rossi', 7]);
  return out;
}

function collect(node: unknown, path: string, out: [string, (...a: unknown[]) => unknown][]) {
  if (typeof node === 'function') out.push([path, node as (...a: unknown[]) => unknown]);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) collect(v, `${path}.${k}`, out);
}

describe('Italian catalog functions', () => {
  it('every function returns a clean non-empty string for at least one sample argument tuple', () => {
    const fns: [string, (...a: unknown[]) => unknown][] = [];
    collect(itCatalog, 'it', fns);
    expect(fns.length).toBeGreaterThan(50);
    const failures: string[] = [];
    for (const [path, fn] of fns) {
      let ok = false;
      for (const args of tuples()) {
        if (args.length < fn.length) continue; // too few arguments: would print undefined by construction
        try {
          const r = fn(...args);
          if (typeof r === 'string' && r.trim() !== '') {
            if (!BAD.test(r)) ok = true; // wrong-typed tuples legitimately print "undefined"; only 'no clean tuple' fails
          }
        } catch {
          /* wrong argument shape for this function: try the next tuple */
        }
      }
      if (!ok) failures.push(path);
    }
    expect(failures, `No clean result for:\n${failures.join('\n')}`).toEqual([]);
  });
});
