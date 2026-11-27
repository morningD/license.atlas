// SPDX-License-Identifier: MulanPSL-2.0

import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const args = process.argv.slice(2);
const SKIP_CRAWL = args.includes("--skip-crawl");
const SKIP_TEST = args.includes("--skip-test");
const flagIdx = process.argv.indexOf("--kb-path");
const KB_ROOT = flagIdx !== -1 && process.argv[flagIdx + 1]
  ? resolve(process.argv[flagIdx + 1])
  : resolve(ROOT, "..", "KB");

if (!existsSync(KB_ROOT)) {
  console.error(`✗ KB not found: ${KB_ROOT}`);
  process.exit(1);
}

function run(cmd, cwd) {
  console.log(`\n▶ ${cmd}  (in ${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function shellQuote(s) {
  return `"${String(s).replace(/(["\\$`])/g, "\\$1")}"`;
}

function passThroughCrawlArgs() {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--force") out.push(a);
    else if (a === "--only") {
      const v = args[i + 1];
      if (!v || v.startsWith("--")) {
        console.error("✗ Missing value for --only");
        process.exit(1);
      }
      out.push(a, shellQuote(v));
      i++;
    } else if (a === "--source" || a === "--sources") {
      const v = args[i + 1];
      if (!v || v.startsWith("--")) {
        console.error(`✗ Missing value for ${a}`);
        process.exit(1);
      }
      out.push(a, shellQuote(v));
      i++;
    } else if (a === "--kb-path") i++;
  }
  return out.join(" ");
}

console.log(`Orchestrating project showcase update in KB: ${KB_ROOT}`);
console.log(`Crawl mode: ${SKIP_CRAWL ? "SKIPPED" : "INCREMENTAL"}`);

if (!SKIP_CRAWL) run(`node crawlers/project_showcase_crawl.js ${passThroughCrawlArgs()}`, KB_ROOT);
run(`node scripts/build-project-showcase.mjs --atlas-index ${shellQuote(resolve(ROOT, "src", "data", "licenses-index.json"))}`, KB_ROOT);
if (!SKIP_TEST) run("node scripts/test-project-showcase-data.mjs", KB_ROOT);
run(`node scripts/sync-project-showcase.mjs --kb-path ${shellQuote(KB_ROOT)}`, ROOT);

console.log("\n✅ Project showcase full-chain update complete.");
