// LicenseAtlas full incremental data update orchestrator.
//
// It runs the core license corpus update in KB (license full texts, HF/GitHub
// custom license discovery with GLM auto-review, popularity stats, cleaning),
// syncs the cleaned corpus into Atlas, then refreshes Atlas sidecars: OSI
// tracker, OSADL, and Popular Projects.
//
// Fully hands-off by default since 2026-08-24: KB temp review runs via GLM
// --llm-review (validated against human review on real candidates), and
// confirmed-manifest slugs are auto-trusted by the sync gate. The remaining
// human gates only trigger on LLM-unresolved candidates or brand-new slugs
// from unvetted sources.
//
// Run:
//   node scripts/update-data.mjs
//   node scripts/update-data.mjs --interactive  # pre-LLM manual review flow
//   node scripts/update-data.mjs --skip-core --skip-build
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const args = process.argv.slice(2);

function has(flag) {
  return args.includes(flag);
}

function value(flag, fallback = null) {
  const i = args.indexOf(flag);
  if (i < 0) return fallback;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : fallback;
}

function shellQuote(s) {
  return `"${String(s).replace(/(["\\$`])/g, "\\$1")}"`;
}

let childEnv = { ...process.env };
function run(cmd, cwd = ROOT) {
  console.log(`\n▶ ${cmd}  (in ${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit", env: childEnv });
}

const KB_ROOT = resolve(value("--kb-path", resolve(ROOT, "..", "KB")));
if (!existsSync(KB_ROOT)) {
  console.error(`✗ KB not found: ${KB_ROOT}`);
  process.exit(1);
}

const skipCore = has("--skip-core");
const skipTracker = has("--skip-tracker");
const skipOsadl = has("--skip-osadl");
const skipProjects = has("--skip-projects");
const skipBuild = has("--skip-build");
const skipFetch = has("--skip-fetch");
const interactive = has("--interactive") || has("--review-hf-custom");
const allowNewLicenses = has("--allow-new-licenses");

function pythonHasPolars(bin) {
  try {
    execSync(`${shellQuote(bin)} -c "import polars"`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function detectPythonBin() {
  const candidates = [
    process.env.PYTHON_BIN,
    "/opt/miniconda3/bin/python3",
    "/opt/homebrew/bin/python3",
    "python3",
  ].filter(Boolean);
  return candidates.find(pythonHasPolars) || "python3";
}

const PYTHON_BIN = detectPythonBin();
childEnv = { ...process.env, PYTHON_BIN };

console.log(`LicenseAtlas incremental data update`);
console.log(`KB: ${KB_ROOT}`);
console.log(`Python: ${PYTHON_BIN}`);
console.log(`HF/GitHub custom review: ${interactive ? "interactive (pre-LLM manual flow)" : "GLM auto (--llm-review)"}`);
console.log(`New license sync: confirmed-manifest slugs auto-trusted${allowNewLicenses ? " + --allow-new-licenses" : ""}`);

if (!skipCore) {
  const coreArgs = ["--skip-atlas"];
  if (skipFetch) coreArgs.push("--skip-fetch");
  if (!interactive) coreArgs.push("--skip-confirm");
  run(`bash scripts/update-all.sh ${coreArgs.join(" ")}`, KB_ROOT);
  const syncArgs = [`--kb-path ${shellQuote(KB_ROOT)}`];
  if (allowNewLicenses) syncArgs.push("--allow-new-licenses");
  run(`node scripts/sync-license-corpus.mjs ${syncArgs.join(" ")}`);
  run("node scripts/update-readme-counts.mjs");
} else {
  console.log("\n↷ Skipping core license corpus update (--skip-core)");
}

if (!skipTracker) {
  const trackerArgs = [`--kb-path ${shellQuote(KB_ROOT)}`];
  for (const flag of ["--month", "--since", "--recent"]) {
    const v = value(flag);
    if (v) trackerArgs.push(`${flag} ${shellQuote(v)}`);
  }
  run(`node scripts/update-tracker.mjs ${trackerArgs.join(" ")}`);
} else {
  console.log("\n↷ Skipping OSI tracker update (--skip-tracker)");
}

if (!skipOsadl) {
  run(`node scripts/update-osadl.mjs --kb-path ${shellQuote(KB_ROOT)}`);
} else {
  console.log("\n↷ Skipping OSADL update (--skip-osadl)");
}

if (!skipProjects) {
  run(`node scripts/update-project-showcase.mjs --kb-path ${shellQuote(KB_ROOT)}`);
} else {
  console.log("\n↷ Skipping project showcase update (--skip-projects)");
}

if (!skipBuild) {
  run("npm run build");
} else {
  run("node scripts/build-search-index.mjs");
  console.log("\n↷ Skipping Next build (--skip-build)");
}

console.log("\n✅ LicenseAtlas incremental data update complete.");
