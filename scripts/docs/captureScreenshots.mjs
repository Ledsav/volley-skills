#!/usr/bin/env node
// Screenshots of every page, desktop and phone, into docs/screenshots/.
//
//   npm run dev:emulator                     # terminal 1: emulators + seed + Vite
//   node scripts/docs/seedShowcase.mjs       # drop the real-data team, fill Men 1
//   node scripts/docs/captureScreenshots.mjs # this script
//
// Drives a headless Chrome over the DevTools protocol (no extra dependency):
// signs in through the Auth emulator's email link, then visits each route at
// 1440×900 and at 390×844 (2× DPR, touch). Local-only: refuses a non-local app URL.
//
// Options: --only <name,name>  capture just those pages; --chrome <path>.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const WS = globalThis.WebSocket ?? require('ws');

const APP = process.env.APP_URL ?? 'http://localhost:5173';
const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8080/v1/projects/volley-skills/databases/(default)/documents';
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'coach@example.com';
const TEAM = 'seed-men-1';
const OUT = 'docs/screenshots';
const PORT = 9333;

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(APP)) {
  console.error('Refusing to run: APP_URL is not a local address.');
  process.exit(1);
}

const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const only = arg('--only')?.split(',');
const chromePath = arg('--chrome') ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(existsSync);
if (!chromePath) { console.error('Chrome not found; pass --chrome <path>.'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- ids the routes need (Firestore emulator REST, owner bypass) ----
async function fsList(path) {
  const res = await fetch(`${FIRESTORE}/${path}?pageSize=300`, { headers: { Authorization: 'Bearer owner' } });
  return (await res.json()).documents ?? [];
}
const idOf = (doc) => doc.name.split('/').pop();
const players = await fsList(`teams/${TEAM}/players`);
const featured = players.find((d) => d.fields.number?.integerValue === '7') ?? players[0];
if (!featured) { console.error(`No players in ${TEAM}: run the seed + seedShowcase first.`); process.exit(1); }
const matches = (await fsList(`teams/${TEAM}/matches`)).map(idOf);
const finished = matches.includes('demo-match') ? 'demo-match' : matches[0];
const live = matches.includes('demo-live') ? 'demo-live' : matches[0];
const PLAYER = idOf(featured);
// The player section picker: underline tabs on desktop, a <select> on phones.
const SECTION_PICKER = '[role=tablist], select';

/**
 * Every page. `run` picks a player section and `click` opens the first card whose
 * text has that string, once the page settles; `scroll` brings a selector into view;
 * `settle` is extra wait for animated pages. `auth: false` pages are shot signed out.
 */
const PAGES = [
  { name: '01-login', path: '/login', auth: false },
  { name: '02-request-access', path: '/request-access', auth: false },
  { name: '03-privacy', path: '/privacy', auth: false },
  { name: '04-home', path: '/' },
  { name: '05-teams', path: '/teams' },
  { name: '06-team-roster', path: `/teams/${TEAM}` },
  { name: '07-team-calendar', path: `/teams/${TEAM}?tab=calendar` },
  { name: '08-team-matches', path: `/teams/${TEAM}?tab=matches` },
  { name: '09-team-stats', path: `/teams/${TEAM}?tab=stats`, settle: 1500 },
  { name: '10-team-plan', path: `/teams/${TEAM}?tab=plan` },
  { name: '11-team-physical', path: `/teams/${TEAM}?tab=physical` },
  { name: '12-team-settings', path: `/teams/${TEAM}?tab=settings` },
  { name: '13-player-skills', path: `/teams/${TEAM}/players/${PLAYER}` },
  { name: '14-player-matches', path: `/teams/${TEAM}/players/${PLAYER}`, run: 'matches', scroll: SECTION_PICKER },
  { name: '15-player-physical', path: `/teams/${TEAM}/players/${PLAYER}`, run: 'physical', settle: 1000, scroll: SECTION_PICKER },
  { name: '16-player-plan', path: `/teams/${TEAM}/players/${PLAYER}`, run: 'plan', scroll: SECTION_PICKER },
  { name: '17-match-report', path: `/teams/${TEAM}/matches/${finished}`, settle: 1000 },
  { name: '18-live-scouting', path: `/teams/${TEAM}/matches/${live}/scout`, settle: 1500 },
  { name: '19-season-awards', path: `/teams/${TEAM}/awards`, settle: 3500 },
  { name: '20-match-awards', path: `/teams/${TEAM}/matches/${finished}/awards`, settle: 3500 },
  { name: '21-exercises', path: '/exercises' },
  { name: '22-diagram-editor', path: '/exercises/demo-attack-approach/diagram', settle: 1000 },
  { name: '23-trainings', path: '/trainings' },
  { name: '24-training-view', path: '/trainings', click: 'TR-0001', settle: 1000 },
  { name: '25-guides', path: '/admin/guides' },
  { name: '26-access', path: '/admin/access' },
  { name: '27-settings', path: '/settings' },
  { name: '28-not-found', path: '/this-page-does-not-exist' },
].filter((p) => !only || only.includes(p.name));

const VIEWPORTS = [
  { dir: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  { dir: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
];

// ---- a minimal DevTools protocol client ----
const profile = mkdtempSync(join(tmpdir(), 'vs-shots-'));
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--lang=en-GB', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank',
], { stdio: 'ignore' });

let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  target = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => null);
}
if (!target) { console.error('Chrome did not start.'); chrome.kill(); process.exit(1); }

const ws = new WS(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let nextId = 1;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(typeof e.data === 'string' ? e.data : e.data.toString());
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

async function goto(path) {
  await send('Page.navigate', { url: APP + path });
  await sleep(400);
  // Settled: a heading (or canvas) is up, no skeleton blocks, no "Loading…"
  // fallback — and still true a few polls later (auth resolves before data).
  let stable = 0;
  for (let i = 0; i < 80 && stable < 4; i++) {
    const ready = await evaluate(`document.readyState === 'complete'
      && !!document.querySelector('h1, canvas')
      && !document.querySelector('[data-skeleton-block]')
      && !/^\\s*Loading/.test(document.body.innerText)`).catch(() => false);
    stable = ready ? stable + 1 : 0;
    await sleep(250);
  }
  await sleep(500);
}

// Open a card (role=button) by its text, e.g. a training's business ID.
const clickCard = (text) => evaluate(`(() => {
  const el = [...document.querySelectorAll('[role=button]')].find((e) => e.offsetParent && e.textContent.includes(${JSON.stringify(text)}));
  el?.click();
  return !!el;
})()`);

// Bring a section into view (player sections sit below the profile header).
const scrollTo = (selector) => evaluate(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.offsetParent);
  if (!el) return false;
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16);
  return true;
})()`);

// Player sections: underline tabs on desktop, a native <select> on phones.
const pickSection = (id) => evaluate(`(() => {
  const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === ${JSON.stringify(id)}));
  if (sel && sel.offsetParent) {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, ${JSON.stringify(id)});
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  const label = ${JSON.stringify(id)}.toLowerCase();
  const tab = [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.trim().toLowerCase() === label);
  tab?.click();
  return !!tab;
})()`);

async function shoot(file) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(file, Buffer.from(data, 'base64'));
}

async function signIn() {
  await goto('/login');
  await evaluate(`(() => {
    const i = document.querySelector('input[type=email]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(EMAIL)});
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.form.requestSubmit();
  })()`);
  await sleep(1500);
  const { oobCodes = [] } = await fetch(`${AUTH}/emulator/v1/projects/volley-skills/oobCodes`).then((r) => r.json());
  const link = oobCodes.filter((c) => c.email === EMAIL && c.requestType === 'EMAIL_SIGNIN').pop()?.oobLink;
  if (!link) throw new Error('No sign-in link from the Auth emulator.');
  await send('Page.navigate', { url: link });
  for (let i = 0; i < 60; i++) {
    if ((await evaluate('location.pathname').catch(() => '')) === '/') return;
    await sleep(250);
  }
  throw new Error('Sign-in did not land on /.');
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setLocaleOverride', { locale: 'en-GB' });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });

  const useViewport = async (vp) => {
    mkdirSync(join(OUT, vp.dir), { recursive: true });
    await send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, mobile: vp.mobile });
    await send('Emulation.setTouchEmulationEnabled', { enabled: vp.mobile });
  };
  const capture = async (vp, pages) => {
    await useViewport(vp);
    for (const page of pages) {
      await goto(page.path);
      if (page.run) { await pickSection(page.run); await sleep(500); }
      if (page.click) { await clickCard(page.click); await sleep(500); }
      if (page.scroll) { await scrollTo(page.scroll); await sleep(300); }
      if (page.settle) await sleep(page.settle);
      await shoot(join(OUT, vp.dir, `${page.name}.png`));
      console.log(`${vp.dir}/${page.name}`);
    }
  };

  // Signed-out pages at every size first: once signed in, /login redirects home.
  const publicPages = PAGES.filter((p) => p.auth === false);
  const appPages = PAGES.filter((p) => p.auth !== false);
  for (const vp of VIEWPORTS) await capture(vp, publicPages);
  if (appPages.length) {
    await useViewport(VIEWPORTS[0]);
    await signIn();
    await evaluate(`localStorage.setItem('theme', 'light')`);
    for (const vp of VIEWPORTS) await capture(vp, appPages);
  }
} finally {
  ws.close();
  chrome.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold files on Windows */ }
}
process.exit(0);
