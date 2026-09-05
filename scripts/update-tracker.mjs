// Full-chain orchestrator: refresh OSI sources in KB, rebuild tracker, then sync to Atlas.
// Run: node scripts/update-tracker.mjs [--full] [--kb-path <path>] [--month YYYY-MM]
//   --full        apply all available LLM batch outputs (kept for compatibility)
//   --kb-path     override KB path (default ../KB)
//   --month       refresh one or more OSI archive months (repeatable)
//   --since       refresh months from YYYY-MM through current month
//   --recent N    refresh the last N months (default 2)
//   --skip-mail   skip mail archive/index/pending discovery steps
//   --skip-status-agent  skip Agent status adjudication steps
//   --status-agent-mode <verify|verify-or-submit|local>  status adjudication runner mode (default verify-or-submit)
//   --strict-manual-pending  fail on any blocking manual-review item (default: unattended
//                 mode — adjudication degrades conflicting/low-confidence verdicts to
//                 pending instead of blocking; manual-review.json is written for audit)
//   --rebaseline  no-op (kept for compatibility; the baseline gate was retired 2026-09-04)
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const args = process.argv.slice(2);
const FULL = args.includes("--full");
const SKIP_MAIL = args.includes("--skip-mail");
const SKIP_STATUS_AGENT = args.includes("--skip-status-agent");
// Known gray-zone evidence conflicts (curated-vs-mail vs OSI API discrepancies) stay
// under manual-review tracking by design; blocking on them every run just wedges the
// orchestrator. Opt back into the old strict behavior with --strict-manual-pending.
const ALLOW_MANUAL_PENDING = !args.includes("--strict-manual-pending");
const statusModeIdx = args.indexOf("--status-agent-mode");
const STATUS_AGENT_MODE = statusModeIdx !== -1 && args[statusModeIdx + 1] && !args[statusModeIdx + 1].startsWith("--")
  ? args[statusModeIdx + 1]
  : "verify-or-submit";
const flagIdx = process.argv.indexOf("--kb-path");
const KB_ROOT = flagIdx !== -1 && process.argv[flagIdx + 1]
  ? resolve(process.argv[flagIdx + 1])
  : resolve(ROOT, "..", "KB");

if (!existsSync(KB_ROOT)) {
  console.error(`✗ KB not found: ${KB_ROOT}`);
  process.exit(1);
}

function run(cmd, cwd, env) {
  console.log(`\n▶ ${cmd}  (in ${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit", ...(env ? { env } : {}) });
}

// Non-blocking variant for gates that may fail transiently (e.g. point
// extraction refused by the LLM provider's content filter). Failure is
// reported and left for the next run's retry instead of aborting the update.
function runSoft(cmd, cwd, label) {
  console.log(`\n▶ ${cmd}  (in ${cwd})`);
  try {
    execSync(cmd, { cwd, stdio: "inherit" });
  } catch (err) {
    console.log(`\n⚠️ ${label || cmd} failed (non-blocking); keeping published data and retrying next run.`);
  }
}

function shellQuote(s) {
  return `"${String(s).replace(/(["\\$`])/g, "\\$1")}"`;
}

// LLM env for status adjudication retries: prefer variables already in the
// environment; otherwise read the zhipuai-coding-plan key from the global
// opencode config (same provider the interactive flow uses).
function llmEnv() {
  const out = { ...process.env };
  if (!out.ANTHROPIC_API_KEY && !out.ANTHROPIC_AUTH_TOKEN) {
    let key = null;
    try {
      const cfg = JSON.parse(readFileSync(join(out.HOME || "", ".config/opencode/opencode.json"), "utf8"));
      const provider = cfg.provider?.["zhipuai-coding-plan"];
      key = provider?.apiKey || provider?.options?.apiKey;
    } catch {}
    if (!key) return null;
    out.ANTHROPIC_API_KEY = key;
    out.ANTHROPIC_AUTH_TOKEN = key;
  }
  if (!out.ANTHROPIC_BASE_URL) out.ANTHROPIC_BASE_URL = "https://open.bigmodel.cn/api/anthropic";
  if (!out.STATUS_ADJUDICATION_MODEL) out.STATUS_ADJUDICATION_MODEL = "glm-4.6";
  if (!out.POINTS_MODEL) out.POINTS_MODEL = "glm-4.6";
  return out;
}

const MANUAL_REVIEW_PATH = join(KB_ROOT, "data", "osi", "status-adjudication", "manual-review.json");
// Unattended operation (2026-09-04): the hard baseline gate over manual-review ids
// was retired. Adjudication now degrades contradictory/low-confidence terminal
// verdicts to pending (the faithful state of an undecided review) instead of
// producing blocking manual items, so runs never stall waiting for a human.
// manual-review.json is still written after every run for audit purposes; review
// it at leisure and correct v2 directly if a degraded verdict needs overriding.

function manualReviewIds() {
  if (!existsSync(MANUAL_REVIEW_PATH)) return [];
  const mr = JSON.parse(readFileSync(MANUAL_REVIEW_PATH, "utf8"));
  return [...new Set((mr.items || []).map(it => it.submission_id))];
}

// Audit-only report of leftover manual-review items (unattended mode). The old
// hard baseline gate lived here; it was retired when adjudication switched to
// conservative degradation (conflicts/low-confidence terminal verdicts become
// pending instead of blocking items). Any ids listed here were degraded by the
// safety net — check manual-review.json for the recorded conflicts and correct
// v2 directly if a degradation was wrong.
function reportManualReviewSoft() {
  const current = manualReviewIds();
  if (current.length) {
    console.log(`\nℹ️ ${current.length} manual-review item(s) on record (audit only, non-blocking): ${current.join(", ")}`);
    console.log(`   Details: ${MANUAL_REVIEW_PATH}`);
  }
}

// Submissions whose adjudication output is missing or invalid (stale input_hash,
// unknown evidence refs, schema violations) and can be fixed by re-running the LLM.
function staleAdjudicationIds() {
  if (!existsSync(MANUAL_REVIEW_PATH)) return [];
  const mr = JSON.parse(readFileSync(MANUAL_REVIEW_PATH, "utf8"));
  return (mr.items || [])
    .filter(it => /^(Invalid adjudication output|Missing agent status adjudication output)/.test(it.reason || ""))
    .map(it => it.submission_id);
}

// Apply adjudications, auto-retrying stale (missing/invalid) outputs via the LLM.
// The model occasionally emits schema-inconsistent output (e.g. conflicts without
// requires_manual_review), so give each id a few passes before giving up.
function applyWithRetry() {
  const applyCmd = `node scripts/apply-status-adjudications.mjs${ALLOW_MANUAL_PENDING ? " --allow-manual-pending" : ""}`;
  run(applyCmd, KB_ROOT);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const stale = staleAdjudicationIds();
    if (!stale.length) return;
    console.log(`\n♻️  ${stale.length} stale adjudication output(s) [${stale.join(", ")}]; re-running LLM (attempt ${attempt}/3)`);
    const env = llmEnv();
    if (!env) throw new Error("Cannot retry stale adjudications: no ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN in env and no zhipuai-coding-plan key in ~/.config/opencode/opencode.json");
    execSync(`node scripts/run-status-adjudication.mjs --mode local --ids ${shellQuote(stale.join(","))}`, {
      cwd: KB_ROOT,
      stdio: "inherit",
      env,
    });
    run(applyCmd, KB_ROOT);
  }
  const remaining = staleAdjudicationIds();
  if (remaining.length) {
    throw new Error(`${remaining.length} adjudication(s) still invalid after 3 LLM retries: ${remaining.join(", ")}`);
  }
}

function passThroughMailArgs() {
  const out = [];
  const flagsWithValues = new Set(["--month", "--since", "--recent", "--lists", "--list"]);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!flagsWithValues.has(a)) continue;
    const v = args[i + 1];
    if (!v || v.startsWith("--")) continue;
    out.push(a, shellQuote(v));
    i++;
  }
  if (!out.length) out.push("--recent", "2");
  return out.join(" ");
}

function pendingSinceArg() {
  const sinceIdx = args.indexOf("--since");
  if (sinceIdx >= 0 && args[sinceIdx + 1] && !args[sinceIdx + 1].startsWith("--")) {
    return `--since ${shellQuote(args[sinceIdx + 1])}`;
  }
  const months = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--month" && args[i + 1] && !args[i + 1].startsWith("--")) {
      months.push(args[i + 1]);
      i++;
    }
  }
  if (months.length) return `--since ${shellQuote(months.sort()[0])}`;
  return "";
}

console.log(`Orchestrating tracker rebuild in KB: ${KB_ROOT}`);
console.log(`LLM mode: ${FULL ? "FULL (re-extract all)" : "INCREMENTAL (new URLs only)"}`);

// 1. Refresh public OSI mailing-list archives and indexes. This covers both
// license-review and license-discuss; the latter joins tracker timelines via
// thread-clusters when linked to an existing/new submission.
if (!SKIP_MAIL) {
  run(`node scripts/update-mail-archives.mjs ${passThroughMailArgs()}`, KB_ROOT);
  run("PLAYWRIGHT_CHANNEL=msedge node crawlers/osi_crawl.js --source minutes", KB_ROOT);
  run("node scripts/rebuild-mail-indexes.mjs", KB_ROOT);
  run(`node scripts/update-pending-submissions.mjs ${pendingSinceArg()}`, KB_ROOT);
} else {
  console.log("\n↷ Skipping mail archive/index refresh (--skip-mail)");
}

// 2. LLM extraction merge (opinion/sentiment). apply-llm-batches is incremental:
// it only consumes batch outputs that already exist under /tmp/llm-batches.
run("node scripts/apply-llm-batches.mjs" + (FULL ? "" : ""), KB_ROOT);

// 3. Build base tracker
run("node scripts/build-license-review-tracker.mjs", KB_ROOT);

// 3.5 Point extraction for new timeline events. extract-full-bodies rebuilds
// the per-submission packages from the fresh v2 (new mail lands there first),
// then extract-all-points summarizes only events missing from the manifest.
// Without this step new posts reach the coverage gate with no point and fail it.
// Both call the LLM, so they need the key env (falls back to the opencode
// config the same way adjudication retries do).
{
  const env = llmEnv();
  if (!env) throw new Error("Point extraction needs ANTHROPIC_API_KEY (or a zhipuai-coding-plan key in ~/.config/opencode/opencode.json)");
  run("node scripts/extract-full-bodies.mjs", KB_ROOT, env);
  run("node scripts/extract-all-points.mjs", KB_ROOT, env);
}

// 4. Enrich
run("node scripts/enrich-license-tracker.mjs", KB_ROOT);

// 3.6 Restore the last adjudicated state before preparing new inputs. build/
// enrich rebuild v2 from source data and reset status + status_review to rule
// values, which would (a) make prepare hash every entry as "changed" and
// (b) silently drop human-calibrated statuses. apply-status-adjudications is
// idempotent: it re-applies the recorded final statuses from the outputs.
// The adjudication safety net (conservative degradation to pending) lives in
// apply-status-adjudications itself, so gray-zone outputs restored here never
// hard-fail; reportManualReviewSoft() below only audits what is left.
run(`node scripts/apply-status-adjudications.mjs${ALLOW_MANUAL_PENDING ? " --allow-manual-pending" : ""}`, KB_ROOT);

// 4.5. Agent status adjudication. Rules only prepare evidence; final status is
// supplied by the adjudicator output and applied before sync. Stale outputs
// (input_hash drift after rebuild) are automatically re-adjudicated by the LLM.
if (!SKIP_STATUS_AGENT) {
  run("node scripts/prepare-status-adjudication.mjs", KB_ROOT);
  run(`node scripts/run-status-adjudication.mjs --mode ${shellQuote(STATUS_AGENT_MODE)}`, KB_ROOT);
  applyWithRetry();
  run(`node scripts/verify-status-adjudications.mjs --require-all${ALLOW_MANUAL_PENDING ? " --allow-manual-pending" : ""}`, KB_ROOT);
  // Normalize outputs to the single baseline batch so runner-produced LLM
  // batches never accumulate and never race the baseline via the
  // hash-first/last-line-wins fallback in loadOutputs.
  run("node scripts/resync-baseline-batch.mjs", KB_ROOT);
  reportManualReviewSoft();
} else {
  console.log("\n↷ Skipping Agent status adjudication (--skip-status-agent)");
}

// 5. Quality gates: validate tracker semantics, point style, and manifest coverage.
// Coverage failures (e.g. sensitive-content refusals on a mail batch) are
// reported but non-blocking: missing points fall back to snippets in the UI
// and the extractor retries them on the next run.
run("node scripts/test-tracker-data.mjs", KB_ROOT);
run("node scripts/check-point-style.mjs --since 2026-01-01", KB_ROOT);
runSoft("node scripts/check-point-manifest-coverage.mjs", KB_ROOT, "point coverage");
run(`node scripts/check-tracker-license-texts.mjs --tracker "${resolve(KB_ROOT, "data", "osi", "license-review-tracker-v2.json")}"`, ROOT);

// 6. Sync to atlas
console.log("\n▶ Syncing to license-atlas...");
run(`node scripts/sync-tracker.mjs --kb-path "${KB_ROOT}"`, ROOT);

console.log("\n✅ Tracker full-chain update complete.");
