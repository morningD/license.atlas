// Keep README license-count mentions in sync with the actual corpus size.
// Run: node scripts/update-readme-counts.mjs [--check]
// --check exits 1 (with a diff) when READMEs are stale — usable as a CI gate.
import { readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const stats = JSON.parse(readFileSync(resolve(ROOT, "src/data/stats.json"), "utf8"));
const total = stats.total;
const pretty = total.toLocaleString("en-US");

const FILES = [
  {
    path: resolve(ROOT, "README.md"),
    patterns: [
      { re: /covering \*\*[\d,]+\*\* licenses/, replacement: `covering **${pretty}** licenses` },
      { re: /— [\d,]+ pre-rendered license pages/, replacement: `— ${pretty} pre-rendered license pages` },
    ],
  },
  {
    path: resolve(ROOT, "README.zh-CN.md"),
    patterns: [
      { re: /覆盖 \*\*[\d,]+\*\* 个许可证/, replacement: `覆盖 **${pretty}** 个许可证` },
      { re: /— [\d,]+ 个预渲染许可证页面/, replacement: `— ${pretty} 个预渲染许可证页面` },
    ],
  },
];

const check = process.argv.includes("--check");
let stale = 0;
for (const file of FILES) {
  let content = readFileSync(file.path, "utf8");
  let changed = false;
  for (const { re, replacement } of file.patterns) {
    const next = content.replace(re, replacement);
    if (next !== content) {
      content = next;
      changed = true;
    }
  }
  if (changed) {
    stale++;
    if (check) {
      console.error(`✗ ${file.path} has stale license counts (expected ${pretty})`);
    } else {
      writeFileSync(file.path, content);
      console.log(`✓ ${file.path.split("/").pop()}: license counts -> ${pretty}`);
    }
  }
}
if (!stale) console.log(`✓ README counts up to date (${pretty})`);
if (check && stale) process.exit(1);
