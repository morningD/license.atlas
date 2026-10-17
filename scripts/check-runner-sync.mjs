#!/usr/bin/env node
/**
 * Red/green regression test for the 2026-10-17 tracker outage.
 *
 * The launchd runner (~/.local/share/license-atlas-tracker/) executes *copies*
 * of the repo scripts because macOS TCC blocks launchd bash from reading
 * ~/Documents, so the "refresh from repo" in run-tracker-update.sh silently
 * fails. On 2026-10-17 the installed probe was 6 weeks stale (repo fix from
 * 09-01 never reached the runner) and the tracker had been down since 10-01.
 *
 * This check fails (exit 1) when:
 *   1. Drift — an installed copy differs from its repo source of truth
 *   2. Stale probe — .tracker-watch-state.json untouched for > 48h
 *      (the probe only writes state on success, so staleness means the
 *      launchd probe has been failing for two days straight)
 *
 * Exit codes: 0 = green, 1 = red, 2 = usage/environment error.
 * A missing runner directory is not an error (repo checked out on a machine
 * without the launchd job) — it prints a notice and exits 0.
 *
 * Usage: npm run check:runner-sync
 */

import { readFileSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_SCRIPTS = __dirname;
const RUNNER_DIR = join(process.env.HOME, '.local/share/license-atlas-tracker');
const SYNCED_FILES = ['check-tracker-updates.mjs', 'auto-update-tracker.sh'];
// launchd probes every 30min; 48h covers sleep/awake deferral without
// masking a real outage (the 2026-10 incident ran silent for 19 days).
const STALE_MS = 48 * 60 * 60 * 1000;

if (!existsSync(RUNNER_DIR)) {
  console.log(`skip: runner not installed at ${RUNNER_DIR} (no launchd job on this machine)`);
  process.exit(0);
}

let red = 0;

for (const name of SYNCED_FILES) {
  const repoPath = join(REPO_SCRIPTS, name);
  const runnerPath = join(RUNNER_DIR, name);
  if (!existsSync(repoPath) || !existsSync(runnerPath)) {
    console.log(`RED: missing file — repo: ${existsSync(repoPath)} runner: ${existsSync(runnerPath)} (${name})`);
    red++;
    continue;
  }
  const repoSrc = readFileSync(repoPath);
  const runnerSrc = readFileSync(runnerPath);
  if (!repoSrc.equals(runnerSrc)) {
    console.log(`RED: drift — runner copy of ${name} differs from repo (fix: cp scripts/${name} ${RUNNER_DIR}/)`);
    red++;
  } else {
    console.log(`green: ${name} in sync`);
  }
}

const statePath = join(RUNNER_DIR, '.tracker-watch-state.json');
if (!existsSync(statePath)) {
  console.log(`RED: missing ${statePath} — probe has never succeeded (run it once manually to create)`);
  red++;
} else {
  const ageMs = Date.now() - statSync(statePath).mtimeMs;
  const ageH = (ageMs / 3600000).toFixed(1);
  if (ageMs > STALE_MS) {
    console.log(`RED: probe state stale (${ageH}h old) — launchd probe failing since then, see ~/.local/share/license-atlas-tracker/logs/`);
    red++;
  } else {
    console.log(`green: probe state fresh (${ageH}h old)`);
  }
}

if (red > 0) {
  console.log(`\n${red} check(s) RED — tracker auto-update is at risk`);
  process.exit(1);
}
console.log('\nall green — runner copies in sync and probe alive');
process.exit(0);
