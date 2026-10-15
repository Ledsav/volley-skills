// src/awards/cutout/csp.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(resolve(process.cwd(), 'firebase.json'), 'utf8')) as {
  hosting: { headers: { headers: { key: string; value: string }[] }[] };
};
const csp = config.hosting.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy')!.value;
const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src'))!;

describe('CSP for on-device background removal', () => {
  it('allows WebAssembly but not JavaScript eval', () => {
    expect(scriptSrc).toContain("'wasm-unsafe-eval'");
    expect(scriptSrc).not.toMatch(/'unsafe-eval'/);
  });
  it('loads model and runtime only from this origin', () => {
    expect(csp).not.toContain('storage.googleapis.com');
    expect(csp).not.toContain('cdn.jsdelivr.net');
  });
});
