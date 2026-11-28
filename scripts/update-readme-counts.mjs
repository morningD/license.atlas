// SPDX-License-Identifier: MulanPSL-2.0

// Keep README license-count mentions in sync with the actual corpus size, and
// the README source-size figures in sync with src/data/source-stats.json.
// Run: node scripts/update-readme-counts.mjs [--check]
// --check exits 1 (with a diff) when READMEs are stale — usable as a CI gate.
import { readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { applyReadmeFigures, README_FIGURE_RULES } from "./lib/source-stats.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const stats = JSON.parse(readFileSync(resolve(ROOT, "src/data/stats.json"), "utf8"));
const total = stats.total;
const pretty = total.toLocaleString("en-US");

let sourceStats = null;
try {
  sourceStats = JSON.parse(readFileSync(resolve(ROOT, "src/data/source-stats.json"), "utf8"));
} catch {
  console.warn("⚠ src/data/source-stats.json not found; source-size figures are left as they are");
}

const FILES = [
  {
    name: "README.md",
    patterns: [
      { re: /covering \*\*[\d,]+\*\* licenses/, replacement: `covering **${pretty}** licenses` },
      { re: /— [\d,]+ pre-rendered license pages/, replacement: `— ${pretty} pre-rendered license pages` },
    ],
  },
  {
    name: "README.zh-CN.md",
    patterns: [
      { re: /覆盖 \*\*[\d,]+\*\* 个许可证/, replacement: `覆盖 **${pretty}** 个许可证` },
      { re: /— [\d,]+ 个预渲染许可证页面/, replacement: `— ${pretty} 个预渲染许可证页面` },
    ],
  },
];

const check = process.argv.includes("--check");
let stale = 0;
for (const file of FILES) {
  const path = resolve(ROOT, file.name);
  const content = readFileSync(path, "utf8");
  const missing = [];

  let next = content;
  for (const { re, replacement } of file.patterns) {
    if (!re.test(next)) {
      missing.push(String(re));
      continue;
    }
    next = next.replace(re, replacement);
  }
  if (sourceStats) {
    const applied = applyReadmeFigures(next, README_FIGURE_RULES[file.name], sourceStats);
    next = applied.content;
    missing.push(...applied.missing.map((name) => `figure "${name}"`));
  }

  // A pattern that no longer matches means the wording changed. Report it, or
  // the script would pass silently and leave a stale number behind.
  for (const item of missing) {
    console.error(`${check ? "✗" : "⚠"} ${file.name}: cannot find ${item}`);
    if (check) stale++;
  }

  if (next !== content) {
    stale++;
    if (check) {
      console.error(`✗ ${file.name} has stale numbers (expected ${pretty})`);
    } else {
      writeFileSync(path, next);
      console.log(`✓ ${file.name}: numbers refreshed (${pretty})`);
    }
  }
}
if (!stale) console.log(`✓ README numbers up to date (${pretty})`);
if (check && stale) process.exit(1);
