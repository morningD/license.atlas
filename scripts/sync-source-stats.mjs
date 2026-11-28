// SPDX-License-Identifier: MulanPSL-2.0

// Sync the source-size figures shown on the About page and in the READMEs:
// the ScanCode LicenseDB count, the Blue Oak rating count, the GitHub license
// types, and the HuggingFace Hub and Meta-Kaggle snapshot sizes. Writes
// src/data/source-stats.json.
// Hash-gated and safe for CI: without the KB checkout, every figure that needs
// KB falls back to the committed file.
// Run: node scripts/sync-source-stats.mjs [--kb-path <path>]
import { existsSync, readFileSync, writeFileSync } from "fs";
import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { collectSourceStats } from "./lib/source-stats.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function resolveKbPath() {
  const flagIdx = process.argv.indexOf("--kb-path");
  if (flagIdx !== -1) {
    const kbPathArg = process.argv[flagIdx + 1];
    if (!kbPathArg || kbPathArg.startsWith("-")) {
      console.error("✗ Missing value for --kb-path");
      console.error("  Usage: node scripts/sync-source-stats.mjs [--kb-path <path>]");
      process.exit(1);
    }
    return resolve(kbPathArg);
  }
  if (process.env.KB_PATH) return resolve(process.env.KB_PATH);
  return resolve(ROOT, "..", "KB");
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

const KB_ROOT = resolveKbPath();
const kbAvailable = existsSync(resolve(KB_ROOT, "data"));
const OUTPUT = resolve(ROOT, "src", "data", "source-stats.json");

// Row counts live in the parquet footers, which need a Python parquet reader.
// The first interpreter that answers is reused for the second file.
const PARQUET_ROWS_SCRIPT = [
  "import sys",
  "try:",
  "    import pyarrow.parquet as pq",
  "    print(pq.ParquetFile(sys.argv[1]).metadata.num_rows)",
  "except ImportError:",
  "    import polars as pl",
  "    print(pl.scan_parquet(sys.argv[1]).select(pl.len()).collect().item())",
].join("\n");
let parquetPython = null;

function parquetRows(relativePath) {
  const file = resolve(KB_ROOT, relativePath);
  if (!existsSync(file)) return null;
  const candidates = parquetPython
    ? [parquetPython]
    : [process.env.PYTHON_BIN, "/opt/miniconda3/bin/python3", "/opt/homebrew/bin/python3", "python3"].filter(Boolean);
  for (const bin of candidates) {
    const run = spawnSync(bin, ["-I", "-c", PARQUET_ROWS_SCRIPT, file], { encoding: "utf8", timeout: 120_000 });
    const rows = Number(run.stdout?.trim());
    if (run.status === 0 && Number.isInteger(rows) && rows >= 0) {
      parquetPython = bin;
      return rows;
    }
  }
  console.warn(`  ⚠ no Python with pyarrow or polars found, cannot read ${relativePath}`);
  return null;
}

const previous = readJson(OUTPUT);
const { stats, notes } = collectSourceStats({
  atlasStats: readJson(resolve(ROOT, "src", "data", "stats.json")),
  previous,
  readKb: (relativePath) => (kbAvailable ? readJson(resolve(KB_ROOT, relativePath)) : null),
  parquetRows: kbAvailable ? parquetRows : () => null,
});
for (const note of notes) console.log(`  · ${note}`);

function withoutTimestamp(stats) {
  const comparable = { ...stats };
  delete comparable.generated_at;
  return JSON.stringify(comparable);
}
if (previous && withoutTimestamp(previous) === withoutTimestamp(stats)) {
  console.log("✓ Source stats unchanged, skip sync");
} else {
  writeFileSync(OUTPUT, `${JSON.stringify(stats, null, 2)}\n`);
  const en = (figure) => figure?.en ?? "—";
  console.log("✓ Source stats synced → src/data/source-stats.json");
  console.log(
    `  ScanCode ${en(stats.scancode.licenses)} · Blue Oak ${en(stats.blueoak.rated)} · GitHub ${en(stats.github.license_types)} license types` +
      ` · HuggingFace ${en(stats.huggingface.models)} models, ${en(stats.huggingface.datasets)} datasets · Kaggle ${en(stats.kaggle.datasets)}`,
  );
}
