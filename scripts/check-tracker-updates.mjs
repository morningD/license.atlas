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
// Probe the current month AND the previous one: pipermail archives keep
// receiving late posts for days into the next month, and the current month's
// directory does not exist until its first mail arrives (404 is normal).
const targets = [0, 1].map((back) => {
  const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
  return `${BASE}/${d.getFullYear()}-${MONTHS[d.getMonth()]}/date.html`;
});

const args = process.argv.slice(2);
if (args.includes('--reset') && existsSync(STATE_PATH)) {
  writeFileSync(STATE_PATH, '{}\n');
  console.log('state reset');
  process.exit(3);
}

let state = {};
try { state = JSON.parse(readFileSync(STATE_PATH, 'utf8')); } catch { state = {}; }

const current = {};
let changedUrl = '';
for (const monthUrl of targets) {
  let res;
  try {
    res = await fetch(monthUrl, { method: 'HEAD', redirect: 'follow' });
  } catch (e) {
    console.error(`probe failed: ${e.message}`);
    process.exit(2);
  }
  if (res.status === 404) {
    // No archive for this month yet (e.g. new month with no mail): not an error.
    console.log(`archive absent (no mail yet): ${monthUrl}`);
    continue;
  }
  if (!res.ok) {
    console.error(`probe failed: HTTP ${res.status} for ${monthUrl}`);
    process.exit(2);
  }
  current[monthUrl] = {
    url: monthUrl,
    lastModified: res.headers.get('last-modified') || '',
    contentLength: res.headers.get('content-length') || '',
  };
  const prev = state[monthUrl];
  if (!prev
    || prev.lastModified !== current[monthUrl].lastModified
    || prev.contentLength !== current[monthUrl].contentLength) {
    changedUrl = monthUrl;
  }
}

// Keep both probed months in state; drop anything older to avoid unbounded growth.
writeFileSync(STATE_PATH, JSON.stringify(current, null, 2) + '\n');

if (changedUrl) {
  const c = current[changedUrl];
  console.log(`change detected: ${changedUrl} (Last-Modified: ${c.lastModified || 'n/a'})`);
  process.exit(3);
}
console.log(`no change (probed ${Object.keys(current).length} month(s))`);
process.exit(0);
