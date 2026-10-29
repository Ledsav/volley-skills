#!/usr/bin/env node
// Builds the link-preview image from the brand kit's white lockup: public/og-image.svg, then
// public/og-image.png (1200x630) with headless Chrome (no extra dependency).
//
//   node scripts/docs/buildOgImage.mjs [--chrome <path>]

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OG, ogImageSvg, pngSize } from './ogImage.mjs';

const i = process.argv.indexOf('--chrome');
const chrome = (i > -1 ? process.argv[i + 1] : null) ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(existsSync);
if (!chrome) { console.error('Chrome not found; pass --chrome <path>.'); process.exit(1); }

const lockup = resolve('docs/design/brand/logo/volley-skills-lockup-white.svg');
const svg = resolve('public/og-image.svg');
const png = resolve('public/og-image.png');

writeFileSync(svg, ogImageSvg(readFileSync(lockup, 'utf8')));

const run = spawnSync(chrome, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  `--window-size=${OG.width},${OG.height}`,
  `--screenshot=${png}`,
  pathToFileURL(svg).href,
], { stdio: 'inherit' });

let size;
try { size = pngSize(readFileSync(png)); } catch { size = null; }
if (run.status !== 0 || !size || size.width !== OG.width || size.height !== OG.height) {
  console.error(`OG image build failed${size ? ` (got ${size.width}x${size.height})` : ''}.`);
  process.exit(1);
}
console.log(`Wrote public/og-image.png (${size.width}×${size.height})`);
