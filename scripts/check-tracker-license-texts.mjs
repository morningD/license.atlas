#!/usr/bin/env node
// SPDX-License-Identifier: MulanPSL-2.0

/**
 * Validate structured license_texts in an OSI tracker JSON file.
 *
 * Usage:
 *   node scripts/check-tracker-license-texts.mjs
 *   node scripts/check-tracker-license-texts.mjs --tracker ../KB/data/osi/license-review-tracker-v2.json
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const trackerIdx = process.argv.indexOf("--tracker");
const trackerPath = trackerIdx >= 0 && process.argv[trackerIdx + 1]
  ? resolve(process.argv[trackerIdx + 1])
  : resolve("public", "data", "tracker.json");
const DATA = JSON.parse(readFileSync(trackerPath, "utf8"));

const errors = [];
const warnings = [];
const allIds = new Set();

function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }
function normUrl(url) {
  return String(url || "").trim().replace(/^http:\/\//i, "https://").replace(/\/$/, "");
}
function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function textSortKey(tx) {
  return [tx.date || "9999-99-99", tx.series || "", tx.message_url || "", tx.filename || ""];
}
function cmpTextSortKey(a, b) {
  for (let i = 0; i < a.length; i++) {
    const c = cmp(a[i], b[i]);
    if (c) return c;
  }
  return 0;
}

let submissionWithTexts = 0;
let totalTexts = 0;
let linkedTexts = 0;
let duplicateTexts = 0;
let totalDiffs = 0;

for (const s of DATA.submissions || []) {
  const texts = s.license_texts || [];
  const timeline = s.timeline || [];
  if (!texts.length) continue;

  submissionWithTexts++;
  totalTexts += texts.length;

  const urlToIndex = new Map();
  timeline.forEach((ev, idx) => {
    const u = normUrl(ev.url);
    if (u && !urlToIndex.has(u)) urlToIndex.set(u, idx);
  });

  let previousSortKey = null;
  const canonicalByHash = new Map();
  const idsInSubmission = new Set();
  const textById = new Map();

  for (const tx of texts) {
    const label = `${s.id} :: ${tx.filename || tx.id || "(unknown text)"}`;

    if (!tx.id) fail(`${label}: missing id`);
    else if (allIds.has(tx.id)) fail(`${label}: duplicate global text id ${tx.id}`);
    else allIds.add(tx.id);

    if (tx.id && idsInSubmission.has(tx.id)) fail(`${label}: duplicate id within submission ${tx.id}`);
    if (tx.id) idsInSubmission.add(tx.id);
    if (tx.id) textById.set(tx.id, tx);

    if (!tx.source_url && !tx.message_url) fail(`${label}: missing both source_url and message_url`);
    if (!tx.sha256 || !/^[a-f0-9]{64}$/i.test(tx.sha256)) fail(`${label}: invalid sha256`);

    const body = tx.display_text || tx.text || tx.normalized_text || "";
    if (!body.trim() && tx.extraction_confidence !== "none") {
      fail(`${label}: empty text/display_text without extraction_confidence=none`);
    }
    if (/^(Dear|Hi|Hello)\b/i.test(body.trim())) {
      fail(`${label}: looks like a mail message, not a license text`);
    }
    if (/License-review mailing list|License-discuss mailing list/i.test(body)) {
      fail(`${label}: contains mailing-list footer`);
    }
    if (/\bI am\b.{0,80}\bsubmitt/i.test(body.slice(0, 1200))) {
      fail(`${label}: contains submission narrative near start`);
    }

    if (/^\d{2,}\.?$/.test(String(tx.version || tx.version_label || ""))) {
      fail(`${label}: suspicious compact version "${tx.version || tx.version_label}"`);
    }

    const sortKey = textSortKey(tx);
    if (previousSortKey && cmpTextSortKey(sortKey, previousSortKey) < 0) {
      fail(`${s.id}: license_texts are not sorted by date/series/message/filename`);
    }
    previousSortKey = sortKey;

    const canonical = canonicalByHash.get(tx.sha256);
    if (canonical) {
      duplicateTexts++;
      if (tx.duplicate_of !== canonical) fail(`${label}: duplicate hash should point to ${canonical}, got ${tx.duplicate_of || "(empty)"}`);
    } else {
      canonicalByHash.set(tx.sha256, tx.id);
      if (tx.duplicate_of) fail(`${label}: first occurrence of hash should not have duplicate_of=${tx.duplicate_of}`);
    }

    const expectedIdx = urlToIndex.get(normUrl(tx.message_url)) ?? urlToIndex.get(normUrl(tx.source_url));
    if (expectedIdx != null) {
      linkedTexts++;
      if (tx.event_index !== expectedIdx) fail(`${label}: event_index ${tx.event_index} should be ${expectedIdx}`);
      const ev = timeline[expectedIdx];
      if (!ev.text_ids || !ev.text_ids.includes(tx.id)) fail(`${label}: linked timeline event missing text_ids entry`);
      const evUrl = normUrl(ev.url);
      if (evUrl !== normUrl(tx.message_url) && evUrl !== normUrl(tx.source_url)) {
        fail(`${label}: event_index points to unrelated URL ${ev.url}`);
      }
    } else if (tx.message_url && /pipermail/.test(tx.message_url)) {
      warn(`${label}: message_url is not in this submission timeline`);
    }
  }

  const diffs = s.license_text_diffs || [];
  totalDiffs += diffs.length;
  const seenDiffIds = new Set();
  for (const diff of diffs) {
    const label = `${s.id} :: diff ${diff.id || "(missing id)"}`;
    if (!diff.id) fail(`${label}: missing id`);
    else if (seenDiffIds.has(diff.id)) fail(`${label}: duplicate diff id`);
    else seenDiffIds.add(diff.id);
    const from = textById.get(diff.from_text_id);
    const to = textById.get(diff.to_text_id);
    if (!from) fail(`${label}: from_text_id not found (${diff.from_text_id})`);
    if (!to) fail(`${label}: to_text_id not found (${diff.to_text_id})`);
    if (from && to && (from.series || "") !== (to.series || "")) {
      fail(`${label}: crosses series ${from.series || "(none)"} -> ${to.series || "(none)"}`);
    }
    if (from?.duplicate_of || to?.duplicate_of) fail(`${label}: diff should not use duplicate text records`);
    if (!diff.stats || !Number.isInteger(diff.stats.added) || !Number.isInteger(diff.stats.removed)) {
      fail(`${label}: missing numeric stats`);
    }
    if (!diff.too_large && (!Array.isArray(diff.hunks) || !diff.hunks.length) && (diff.stats?.added || diff.stats?.removed)) {
      fail(`${label}: changed diff has no hunks`);
    }
  }
}

const modelGo = (DATA.submissions || []).find((s) => s.id === "modelgo-attribution-v2");
if (modelGo) {
  const series = new Set((modelGo.license_texts || []).map((t) => t.series).filter(Boolean));
  for (const required of ["MG0", "MG-BY", "MG-BY-OS", "MG-BY-SA"]) {
    if (!series.has(required)) fail(`modelgo-attribution-v2: missing series ${required}`);
  }
  const linked = (modelGo.license_texts || []).filter((t) => Number.isInteger(t.event_index)).length;
  if (linked < 12) fail(`modelgo-attribution-v2: expected at least 12 linked text records, got ${linked}`);
  const diffs = modelGo.license_text_diffs || [];
  if (diffs.length < 6) fail(`modelgo-attribution-v2: expected at least 6 text diffs, got ${diffs.length}`);
} else {
  fail("modelgo-attribution-v2: missing submission");
}

console.log(`license text submissions: ${submissionWithTexts}`);
console.log(`license text records: ${totalTexts}`);
console.log(`linked to timeline: ${linkedTexts}`);
console.log(`duplicates marked: ${duplicateTexts}`);
console.log(`license text diffs: ${totalDiffs}`);
if (warnings.length) {
  console.log(`warnings: ${warnings.length}`);
  for (const w of warnings.slice(0, 20)) console.log(`  warn: ${w}`);
  if (warnings.length > 20) console.log(`  ... ${warnings.length - 20} more warnings`);
}

if (errors.length) {
  console.error(`\n✗ license text validation failed: ${errors.length} error(s)`);
  for (const e of errors.slice(0, 80)) console.error(`  - ${e}`);
  if (errors.length > 80) console.error(`  ... ${errors.length - 80} more errors`);
  process.exit(1);
}

console.log(`✓ license text validation passed (${trackerPath})`);
