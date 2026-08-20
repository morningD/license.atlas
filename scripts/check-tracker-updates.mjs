#!/usr/bin/env node
/**
 * Lightweight change detector for the OSI license-review archive.
 *
 * HEAD-requests the current month's Pipermail date.html and compares
 * Last-Modified / Content-Length against the last seen state.
 *
 * Exit codes:
 *   0  no change (or only transient noise)
 *   2  network/server error (caller may retry later)
 *   3  change detected (new messages or new month) -> run full update
 *
 * Usage:
 *   node scripts/check-tracker-updates.mjs          # normal probe
 *   node scripts/check-tracker-updates.mjs --reset  # forget state, force exit 3 once
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, '.tracker-watch-state.json');
const BASE = 'https://lists.opensource.org/pipermail/license-review_lists.opensource.org';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const now = new Date();
const monthUrl = `${BASE}/${now.getFullYear()}-${MONTHS[now.getMonth()]}/date.html`;

const args = process.argv.slice(2);
if (args.includes('--reset') && existsSync(STATE_PATH)) {
  writeFileSync(STATE_PATH, '{}\n');
  console.log('state reset');
  process.exit(3);
}

let state = {};
try { state = JSON.parse(readFileSync(STATE_PATH, 'utf8')); } catch { state = {}; }

let res;
try {
  res = await fetch(monthUrl, { method: 'HEAD', redirect: 'follow' });
} catch (e) {
  console.error(`probe failed: ${e.message}`);
  process.exit(2);
}
if (!res.ok) {
  console.error(`probe failed: HTTP ${res.status} for ${monthUrl}`);
  process.exit(2);
}

const current = {
  url: monthUrl,
  lastModified: res.headers.get('last-modified') || '',
  contentLength: res.headers.get('content-length') || '',
};

const prev = state[current.url];
const changed = !prev
  || prev.lastModified !== current.lastModified
  || prev.contentLength !== current.contentLength;

// Keep only the newest month entry to avoid unbounded growth.
writeFileSync(STATE_PATH, JSON.stringify({ [current.url]: current }, null, 2) + '\n');

if (changed) {
  console.log(`change detected: ${current.url} (Last-Modified: ${current.lastModified || 'n/a'})`);
  process.exit(3);
}
console.log(`no change: ${current.url} (Last-Modified: ${current.lastModified || 'n/a'})`);
process.exit(0);
