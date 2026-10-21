#!/usr/bin/env node
// Prints docs/marketing/volley-skills-overview.html to a shareable A4 PDF with
// headless Chrome (no extra dependency). Re-run after recapturing screenshots.
//
//   node scripts/docs/buildBrochure.mjs [--chrome <path>]

import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const i = process.argv.indexOf('--chrome');
const chrome = (i > -1 ? process.argv[i + 1] : null) ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(existsSync);
if (!chrome) { console.error('Chrome not found; pass --chrome <path>.'); process.exit(1); }

const src = resolve('docs/marketing/volley-skills-overview.html');
const out = resolve('docs/marketing/volley-skills-overview.pdf');

const run = spawnSync(chrome, [
  '--headless=new', '--disable-gpu', '--no-first-run',
  // The page loads fonts, logos and screenshots from sibling folders over file://.
  '--allow-file-access-from-files',
  '--no-pdf-header-footer', '--virtual-time-budget=10000',
  `--print-to-pdf=${out}`,
  pathToFileURL(src).href,
], { stdio: 'inherit' });

if (run.status !== 0 || !existsSync(out)) { console.error('PDF build failed.'); process.exit(1); }
console.log(`Wrote ${out} (${Math.round(statSync(out).size / 1024)} KB)`);
