// SPDX-License-Identifier: MulanPSL-2.0

// Source-size figures shown on the About page and in the READMEs: how many
// licenses ScanCode LicenseDB contributes, how many licenses Blue Oak rates,
// how many license types GitHub is counted for, and how large the HuggingFace
// Hub and Meta-Kaggle snapshots are.
//
// Pure functions only, so the rules can be unit-tested without the KB
// checkout: node --test scripts/tests/source-stats.test.mjs

export const SCANCODE_SOURCE_KEY = "scancode-licensedb.aboutcode.org";

// Inputs, relative to the KB root.
export const KB_INPUTS = {
  blueoak: "data/licenses/blueoak-list.json",
  github: "data/github-stats/license-counts.json",
  kaggle: "data/kaggle-stats/crawl_state.json",
  modelsParquet: "data/hf-hub-stats/.cache/models.parquet",
  datasetsParquet: "data/hf-hub-stats/.cache/datasets.parquet",
};

// A count the page states exactly, such as the number of rated licenses.
export function exactFigure(n) {
  const label = n.toLocaleString("en-US");
  return { value: n, en: label, zh: label };
}

// A platform size the page states as a lower bound ("3.2M+ models"). Rounded
// down, so the label never overstates the real count.
export function approxFigure(n) {
  const exact = n.toLocaleString("en-US");
  const en = n >= 1e6 ? `${Math.floor(n / 1e5) / 10}M+` : n >= 1e3 ? `${Math.floor(n / 1e3)}K+` : exact;
  const zh = n >= 1e6 ? `${Math.floor(n / 1e5) * 10} 万+` : n >= 1e5 ? `${Math.floor(n / 1e3) / 10} 万+` : exact;
  return { value: n, en, zh };
}

function isCount(n) {
  return Number.isInteger(n) && n >= 0;
}

// Build the figure set. `readKb(relativePath)` returns parsed JSON or null and
// `parquetRows(absolutePath)` returns a row count or null; both are injected so
// that tests can stand in for the KB. An input that is unavailable leaves the
// committed figure in place, which is what keeps CI builds safe.
export function collectSourceStats({ atlasStats, previous, readKb, parquetRows, now = new Date() }) {
  const notes = [];

  function figure(name, value, kept, format) {
    if (isCount(value)) return format(value);
    notes.push(kept ? `${name}: input unavailable, keeping the committed figure` : `${name}: input unavailable and no committed figure`);
    return kept ?? null;
  }

  const scancode = figure(
    "scancode",
    atlasStats?.by_source?.[SCANCODE_SOURCE_KEY],
    previous?.scancode?.licenses,
    exactFigure,
  );

  const blueoakList = readKb(KB_INPUTS.blueoak);
  const rated = Array.isArray(blueoakList?.ratings)
    ? blueoakList.ratings.reduce((n, tier) => n + (Array.isArray(tier?.licenses) ? tier.licenses.length : 0), 0)
    : null;
  const blueoak = figure("blueoak", rated, previous?.blueoak?.rated, exactFigure);

  const githubCounts = readKb(KB_INPUTS.github)?.counts;
  const licenseTypes = githubCounts && typeof githubCounts === "object" ? Object.keys(githubCounts).length : null;
  const github = figure("github", licenseTypes, previous?.github?.license_types, exactFigure);

  const models = parquetRows(KB_INPUTS.modelsParquet);
  const datasets = parquetRows(KB_INPUTS.datasetsParquet);
  const huggingface = {
    models: figure("huggingface models", models, previous?.huggingface?.models, approxFigure),
    datasets: figure("huggingface datasets", datasets, previous?.huggingface?.datasets, approxFigure),
  };

  const kaggleState = readKb(KB_INPUTS.kaggle)?.["meta-license-tags"];
  const kaggleVersion = typeof kaggleState?.meta_kaggle_version === "string" ? kaggleState.meta_kaggle_version : null;
  const kaggle = {
    datasets: figure("kaggle", kaggleState?.total_datasets, previous?.kaggle?.datasets, approxFigure),
    meta_kaggle_version: kaggleVersion ?? previous?.kaggle?.meta_kaggle_version ?? null,
  };

  return {
    stats: {
      schema_version: 1,
      generated_at: now.toISOString(),
      scancode: { licenses: scancode },
      blueoak: { rated: blueoak },
      github: { license_types: github },
      huggingface,
      kaggle,
    },
    notes,
  };
}

// The README phrases that carry a source-size figure. The wording around the
// number is the anchor: if a README is reworded the rule stops matching, and
// update-readme-counts.mjs reports the rule instead of passing silently.
// Each pattern accepts every label its template can write, including a plain
// count without a "+" (written when a value falls below the rounding unit);
// otherwise such a number could never be rewritten once it had been stored.
export const README_FIGURE_RULES = {
  "README.md": [
    {
      name: "HuggingFace models",
      re: /HuggingFace Hub \([\d.,]+(?:[MK]\+)? models\)/,
      label: (s) => s.huggingface?.models?.en,
      template: (label) => `HuggingFace Hub (${label} models)`,
    },
    {
      name: "GitHub license types",
      re: /GitHub \(\d[\d,]* license types\)/,
      label: (s) => s.github?.license_types?.en,
      template: (label) => `GitHub (${label} license types)`,
    },
    {
      name: "Kaggle datasets",
      re: /Kaggle \([\d.,]+(?:[MK]\+)? datasets via Meta-Kaggle\)/,
      label: (s) => s.kaggle?.datasets?.en,
      template: (label) => `Kaggle (${label} datasets via Meta-Kaggle)`,
    },
  ],
  "README.zh-CN.md": [
    {
      name: "HuggingFace models",
      re: /HuggingFace Hub（[\d.,]+(?: 万\+)? 模型）/,
      label: (s) => s.huggingface?.models?.zh,
      template: (label) => `HuggingFace Hub（${label} 模型）`,
    },
    {
      name: "GitHub license types",
      re: /GitHub（\d[\d,]* 种许可证类型）/,
      label: (s) => s.github?.license_types?.zh,
      template: (label) => `GitHub（${label} 种许可证类型）`,
    },
    {
      name: "Kaggle datasets",
      re: /通过 Meta-Kaggle 覆盖 [\d.,]+(?: 万\+)? 数据集/,
      label: (s) => s.kaggle?.datasets?.zh,
      template: (label) => `通过 Meta-Kaggle 覆盖 ${label} 数据集`,
    },
  ],
};

// Rewrites the phrases in `content` from `stats`. Returns the new content plus
// the names of the rules whose phrase is not in the content, or whose figure
// is missing.
export function applyReadmeFigures(content, rules, stats) {
  let next = content;
  const missing = [];
  for (const rule of rules) {
    const label = rule.label(stats);
    if (!label || !rule.re.test(next)) {
      missing.push(rule.name);
      continue;
    }
    next = next.replace(rule.re, rule.template(label));
  }
  return { content: next, missing };
}
