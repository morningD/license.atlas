# LicenseAtlas

English | [中文](README.zh-CN.md)

LicenseAtlas is a software, data, AI model, and agent license explorer covering **2,640** licenses and terms — searchable, filterable, comparable, and available in English and Chinese.

**Live site**: [LicenseAtlas](https://morningd.github.io/license.atlas)

## Features

- **Full-text search** — search license name, SPDX id, source, and body text, with fuzzy matching and exact/prefix SPDX-slug matches ranked first (powered by MiniSearch)
- **Category filters** — software, model, data, agent, terms
- **Tag filters** — Permissive, Copyleft, Creative Commons, Hardware, etc.
- **Popularity & trends** — sparkline charts from HuggingFace, GitHub, and Kaggle data
- **[OSI License Review Tracker](https://morningd.github.io/license.atlas/tracker)** (`/tracker`) — live board of 194 OSI license submissions, review status, board votes, timelines, and linked license-text history
- **OSADL checklist signals** — obligation/prohibition summaries, copyleft/source-disclosure/patent hints, and directional compatibility data for matched licenses
- **Popular Projects** — right-rail showcase of top GitHub, HuggingFace, and Kaggle projects for selected licenses, with source-aware incremental refresh
- **Bilingual UI** — English/Chinese with automatic browser language detection
- **Dark mode** — system preference + manual toggle
- **Static export** — 2,640 pre-rendered license pages, fast loading

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router, static export)
- [MiniSearch](https://github.com/lucaong/minisearch) (client-side full-text search)
- [Tailwind CSS v4](https://tailwindcss.com)
- TypeScript

## Development

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # static export to out/
```

Data-source maintenance commands:

```bash
npm run update:data     # full incremental update: core license texts + tracker + OSADL + project showcase
npm run sync:licenses   # sync already-cleaned KB license corpus into Atlas
npm run update:tracker   # refresh OSI license-review/license-discuss data via the sibling KB checkout
npm run update:osadl     # refresh OSADL checklist raw data via the sibling KB checkout
npm run update:projects  # refresh GitHub/HuggingFace/Kaggle showcase sidecar data via the sibling KB checkout
npm run update:projects -- --source huggingface --force  # refresh one showcase source only
npm run sync:tracker     # sync already-built KB tracker data into Atlas
npm run sync:osadl       # sync already-built KB OSADL checklist data into Atlas
npm run sync:projects    # sync already-built KB project-showcase data into Atlas
```

Use `npm run update:data` as the normal update entry point. It starts with the KB
core license corpus pipeline (including license full-text discovery and
cleaning), syncs the cleaned corpus into Atlas, then refreshes tracker, OSADL,
and project-showcase sidecars. The per-source commands above are for targeted
debugging or recovery. See [Data Update Workflow](docs/data-update-workflow.md).
New license slugs are blocked by default during `sync:licenses`; run the KB
dedupe / cleanup / confirmation workflow first, then rerun with
`--allow-new-licenses` only after review is complete.

`npm run build` always regenerates the search index, syncs tracker, OSADL, and project-showcase sidecar data, and then runs the static Next.js build. The build script currently sets `NEXT_PRIVATE_BUILD_WORKER=0` to avoid a Next.js 16 webpack worker hang observed in local and CI builds.

## Data Sources

License texts are aggregated from:

| Source | Coverage |
|--------|----------|
| SPDX | 695 licenses |
| TLDRLegal | 145 licenses |
| OSI | 123 approved licenses |
| GNU / FSF | 66 licenses |
| Creative Commons | 37 licenses |
| choosealicense.com | 47 licenses |
| ScanCode LicenseDB | Custom license texts and metadata |
| Blue Oak Council | Permissive-license quality ratings |
| HuggingFace Hub | Custom model & dataset licenses |
| GitHub | Agent skill, MCP server, and tool licenses |
| Open Data Commons | 3 data licenses |
| RAIL | Responsible AI licenses |
| OpenAtom Foundation | Model and hardware licenses (bilingual CN/EN) |
| OpenMDW | Permissive license for ML models and related artifacts (Linux Foundation) |
| OSI Review Tracker | 194 OSI license-review submissions, timelines, first/decision dates, board-vote records, and locally archived submitted license texts from public review/discussion records |
| OSADL Open Source License Checklists | 124 checklist records, 123 matched LicenseAtlas pages, checklist-derived obligations/prohibitions, copyleft/source-disclosure/patent hints, and directional compatibility summaries |
| Project Showcase | 32 selected licenses with top GitHub repositories, HuggingFace models, and Kaggle datasets, normalized into a compact right-rail detail-page sidecar |

Popularity data comes from HuggingFace Hub (2.8M+ models), GitHub (28 license types), and Kaggle (714K+ datasets via Meta-Kaggle). License-card sparklines use HuggingFace monthly license-trends extracted from the models parquet; repository counts and project showcase data come from GitHub, and dataset popularity comes from Kaggle. Project Showcase ranks GitHub entries by stars, HuggingFace entries by the local Hub `trendingScore` when a license has active trend signal, and Kaggle entries by votes; HF groups with a top trend score below 5 fall back to likes and show top 5 unless the fifth item has more than 5 likes, in which case they show top 10. A license is included when Atlas aggregate counters cross the rollout threshold or raw source data contains a clearly popular top item. The updater is incremental at the source layer: GitHub uses per-license freshness windows, HuggingFace uses a parquet fingerprint gate, Kaggle uses the latest Meta-Kaggle version id plus cached API-resolved URL/thumbnail metadata, and Atlas-side sync is hash-gated. Popular Projects can be refreshed independently with `npm run update:projects`; source-specific refreshes are supported with `npm run update:projects -- --source <github|huggingface|kaggle> --force`.
The site footer reports the latest data update using the newest timestamp from the license corpus, the OSI review tracker sync, the OSADL checklist sync, and the project-showcase sync, shown inline with the page-view counter.
Submitted license texts in the OSI Review Tracker are reproduced from public OSI review/discussion records for research and review-tracking purposes; copyright remains with the original authors or license stewards.
OSADL checklist data is attributed to Open Source Automation Development Lab (OSADL) eG, distributed by OSADL as CC-BY-4.0 raw data, and shown as informational compliance metadata rather than legal advice.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
