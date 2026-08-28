// Sync OSI License Review Tracker from KB → license-atlas.
// Hash-gated: no-op when KB v2.json is unchanged (idempotent).
// Run: node scripts/sync-tracker.mjs [--kb-path <path>]
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Resolve KB path: --kb-path flag, else env, else ../KB relative to atlas.
function resolveKbPath() {
  const flagIdx = process.argv.indexOf("--kb-path");
  if (flagIdx !== -1) {
    const kbPathArg = process.argv[flagIdx + 1];
    if (!kbPathArg || kbPathArg.startsWith("-")) {
      console.error("✗ Missing value for --kb-path");
      console.error("  Usage: node scripts/sync-tracker.mjs [--kb-path <path>]");
      process.exit(1);
    }
    return resolve(kbPathArg);
  }
  if (process.env.KB_PATH) return resolve(process.env.KB_PATH);
  return resolve(ROOT, "..", "KB");
}
const KB_ROOT = resolveKbPath();
const KB_V2 = resolve(KB_ROOT, "data", "osi", "license-review-tracker-v2.json");

const ATLAS_FULL = resolve(ROOT, "public", "data", "tracker.json");
const ATLAS_INDEX = resolve(ROOT, "src", "data", "tracker-index.json");
const ATLAS_META = resolve(ROOT, "src", "data", "tracker-meta.json");
const INDEX_SCHEMA_VERSION = 5; // v5: index entries carry aliases for search ranking

if (!existsSync(KB_V2)) {
  if (existsSync(ATLAS_FULL) && existsSync(ATLAS_INDEX)) {
    const existing = JSON.parse(readFileSync(ATLAS_INDEX, "utf8"));
    console.log(`✓ KB v2.json not found at ${KB_V2}`);
    console.log(`  Using committed tracker data (hash ${existing?._meta?.source_hash || "unknown"}).`);
    process.exit(0);
  }
  console.error(`✗ KB v2.json not found: ${KB_V2}`);
  console.error("  Pass --kb-path <path> or set KB_PATH env, or commit public/data/tracker.json and src/data/tracker-index.json.");
  process.exit(1);
}

// ── Compute source hash from KB v2.json ──
const kbRaw = readFileSync(KB_V2, "utf8");
const kbData = JSON.parse(kbRaw);
// Ignore rebuild-time-only fields so repeated `update:tracker` runs do not
// create fake data updates when the tracker content itself is unchanged.
function stableTrackerPayload(data) {
  const copy = JSON.parse(JSON.stringify(data));
  if (copy.meta) {
    delete copy.meta.generated_at;
    delete copy.meta.enriched_at;
  }
  return JSON.stringify(copy);
}
const sourceHash = createHash("sha1").update(stableTrackerPayload(kbData)).digest("hex").slice(0, 16);

// ── Idempotency check ──
// Hash gate covers the tracker trio (tracker.json/index/meta). Mail body
// shards have their own lightweight gate: a hash of KB mail-bodies.json
// stored in shards/_meta.json — so updating mail data alone does not
// require a tracker data change to re-sync shards.
const KB_BODIES = resolve(KB_ROOT, "data", "osi", "mail-bodies.json");
const SHARD_DIR = resolve(ROOT, "public", "data", "mail-bodies");
const SHARD_META = resolve(SHARD_DIR, "_meta.json");
const bodiesRaw = existsSync(KB_BODIES) ? readFileSync(KB_BODIES, "utf8") : null;
const bodiesHash = bodiesRaw ? createHash("sha1").update(bodiesRaw).digest("hex").slice(0, 16) : "";
let shardsCurrent = false;
if (existsSync(SHARD_META)) {
  try {
    shardsCurrent = JSON.parse(readFileSync(SHARD_META, "utf8")).bodies_hash === bodiesHash;
  } catch { shardsCurrent = false; }
}
if (existsSync(ATLAS_INDEX) && existsSync(ATLAS_META)) {
  try {
    const existing = JSON.parse(readFileSync(ATLAS_INDEX, "utf8"));
    if (existing?._meta?.source_hash === sourceHash && existing?._meta?.index_schema_version === INDEX_SCHEMA_VERSION) {
      if (shardsCurrent) {
        console.log(`✓ tracker 无变化 (hash ${sourceHash})，跳过同步`);
        process.exit(0);
      }
      console.log(`✓ tracker 无变化 (hash ${sourceHash})，仅更新 mail body shards`);
      const allBodies = JSON.parse(bodiesRaw);
      syncMailShards(allBodies);
      process.exit(0);
    }
  } catch {
    // index corrupt → regenerate below
  }
}

// ── spdx normalize (lowercase, trimmed) for matching robustness ──
const normSpdx = (s) => (s || "").trim().toLowerCase();
const isoDate = (s) => {
  const raw = String(s || "").trim();
  let m = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return "";
};
const firstSubmittedDate = (s, tl) =>
  isoDate(s.osi_api_data?.submission_date) ||
  isoDate((tl || []).find((ev) => ev.type === "submission")?.date) ||
  isoDate(s.stats?.date_range?.[0]);
const decisionDate = (s, tl) => {
  if (!["approved", "rejected"].includes(s.status)) return "";
  return isoDate(s.osi_api_data?.approval_date) ||
    isoDate(s.board_vote?.date) ||
    isoDate((tl || []).find((ev) => ev.type === "board_decision")?.date);
};
const textMeta = (s) => {
  const texts = s.license_texts || [];
  return {
    count: texts.length,
    linked_count: texts.filter((t) => Number.isInteger(t.event_index)).length,
    duplicate_count: texts.filter((t) => t.duplicate_of).length,
    diff_count: (s.license_text_diffs || []).length,
    series: [...new Set(texts.map((t) => t.series).filter(Boolean))].sort(),
    latest_text_date: texts.map((t) => isoDate(t.date)).filter(Boolean).sort().at(-1) || "",
  };
};

// ── Build lightweight index keyed by normalized spdx_id ──
const index = {
  _meta: {
    source_hash: sourceHash,
    index_schema_version: INDEX_SCHEMA_VERSION,
    generated_at: kbData.meta?.enriched_at || kbData.meta?.generated_at || "",
    total_submissions: kbData.submissions.length,
    by_status: kbData.meta?.by_status || {},
  },
};
const meta = index._meta;

// Also keep an id-keyed list for /tracker lookup by ?focus= (id or spdx).
const byKey = {};
for (const s of kbData.submissions) {
  const tl = s.timeline || [];
  const latest = tl.length ? tl[tl.length - 1] : null;
  const entry = {
    id: s.id,
    name: s.name,
    spdx_id: s.spdx_id || "",
    aliases: s.aliases || [],
    status: s.status,
    submitter: s.submitter?.name || "Unknown",
    stats: {
      total_messages: s.stats?.total_messages || 0,
      duration_days: s.stats?.duration_days || 0,
      date_range: s.stats?.date_range || [],
    },
    has_vote: !!s.board_vote,
    has_timeline: tl.length > 0,
    review_dates: {
      first_submitted: firstSubmittedDate(s, tl),
      decision: decisionDate(s, tl),
      decision_status: ["approved", "rejected"].includes(s.status) ? s.status : "",
    },
    text_meta: textMeta(s),
    timeline_meta: {
      count: tl.length,
      first: tl.length ? tl[0].date : null,
      last: tl.length ? tl[tl.length - 1].date : null,
    },
    latest_event: latest ? {
      date: latest.date || "",
      type: latest.type || "",
      source: latest.source || "",
      sender: latest.sender || "",
      subject: latest.subject || "",
      sentiment: latest.sentiment || "",
      point: latest.point || latest.snippet || "",
      point_zh: latest.point_zh || "",
    } : null,
  };
  // Key by normalized spdx if present, else by id
  const key = s.spdx_id ? normSpdx(s.spdx_id) : normSpdx(s.id);
  byKey[key] = entry;
  if (s.spdx_id) byKey[normSpdx(s.id)] = entry; // also allow id lookup
}
Object.assign(index, byKey);

// ── Write outputs ──
mkdirSync(dirname(ATLAS_FULL), { recursive: true });
copyFileSync(KB_V2, ATLAS_FULL);
writeFileSync(ATLAS_INDEX, JSON.stringify(index, null, 2));
writeFileSync(ATLAS_META, JSON.stringify(meta, null, 2));

// ── Mail body shards (full-text timeline view) ──
// Per-submission shard: public/data/mail-bodies/{id}.json containing the
// full bodies of every timeline message resolvable from KB mail-bodies.json.
// Only urls referenced by that submission's timeline go into its shard, so
// each file stays ~tens of KB. Orphan shards of removed submissions are
// pruned.
function syncMailShards(allBodies) {
  mkdirSync(SHARD_DIR, { recursive: true });
  const validShards = new Set(["_meta.json"]);
  let nMsgs = 0, nMissing = 0;
  const shardsMeta = { bodies_hash: bodiesHash, generated_at: new Date().toISOString(), submissions: {} };
  for (const s of kbData.submissions) {
    const entries = {};
    for (const ev of s.timeline || []) {
      if (!ev.url) continue;
      const b = allBodies[ev.url];
      if (b) { entries[ev.url] = b; nMsgs++; }
      else nMissing++;
    }
    const fname = `${s.id}.json`;
    validShards.add(fname);
    writeFileSync(resolve(SHARD_DIR, fname), JSON.stringify(entries));
    shardsMeta.submissions[s.id] = { messages: Object.keys(entries).length };
  }
  writeFileSync(SHARD_META, JSON.stringify(shardsMeta));
  // Prune shards that no longer correspond to any submission.
  for (const f of readdirSync(SHARD_DIR)) {
    if (f.endsWith(".json") && !validShards.has(f)) rmSync(resolve(SHARD_DIR, f));
  }
  console.log(`✓ mail body shards: ${nMsgs} messages matched (${nMissing} timeline urls without archive body) → public/data/mail-bodies/`);
}

if (bodiesRaw) {
  syncMailShards(JSON.parse(bodiesRaw));
} else {
  console.log(`⚠ KB mail-bodies.json not found — mail body shards not updated`);
}

console.log(`✓ 同步 ${kbData.submissions.length} submissions → public/data/tracker.json + src/data/tracker-index.json + src/data/tracker-meta.json`);
console.log(`  source_hash: ${sourceHash}`);
console.log(`  by_status: ${JSON.stringify(kbData.meta?.by_status || {})}`);
