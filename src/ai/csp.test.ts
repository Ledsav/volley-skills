import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(resolve(process.cwd(), 'firebase.json'), 'utf8')) as {
  hosting: { headers: { headers: { key: string; value: string }[] }[] };
};
const all = config.hosting.headers.flatMap((h) => h.headers);
const csp = all.find((h) => h.key === 'Content-Security-Policy')!.value;
const connectSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src'))!;

describe('CSP for AI requests', () => {
  it('lets the browser reach only Firebase, Groq, OpenRouter and this computer', () => {
    const hosts = connectSrc.split(/\s+/).slice(1);
    for (const h of hosts) {
      expect(h).toMatch(/^('self'|https:\/\/[^ ]*googleapis\.com|https:\/\/apis\.google\.com|https:\/\/api\.groq\.com|https:\/\/openrouter\.ai|http:\/\/localhost:\*|http:\/\/127\.0\.0\.1:\*)$/);
    }
  });

  it('reports (does not yet enforce) Trusted Types', () => {
    const ro = all.find((h) => h.key === 'Content-Security-Policy-Report-Only');
    expect(ro?.value).toBe("require-trusted-types-for 'script'");
  });
});
