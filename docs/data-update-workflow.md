# LicenseAtlas Data Update Workflow

LicenseAtlas has one full incremental update entry point:

```bash
npm run update:data
```

This command is the preferred operational entry point. It updates the core
license corpus first, then refreshes sidecar data used by detail pages and the
tracker.

## Update Order

1. **Core license corpus** in the sibling KB checkout
   - Runs `../KB/scripts/update-all.sh --skip-atlas --skip-confirm` by default.
   - Crawls standard license full texts via `crawlers/licenses_crawl.js`.
   - Crawls ScanCode LicenseDB via `crawlers/scancode_crawl.js`.
   - Refreshes HuggingFace, GitHub, and Kaggle popularity inputs. HuggingFace
     refresh includes both license tag counts and `license-trends.json`; the
     trend file is keyed to the current `models.parquet` ETag and feeds the
     license-card sparkline data.
   - Processes HuggingFace custom license discoveries with GLM auto-review:
     `hf-custom-license-incremental-update.py --apply --llm-review` sends each
     new temp candidate to GLM (default glm-4.6, `HF_REVIEW_MODEL` override),
     which returns include (with a corrected official license name) or discard.
     Included candidates move into `confirmed/` and update the manifest;
     discarded decisions persist to `discarded.json` so the raw files never
     regenerate a temp. Schema-invalid candidates after 3 retries stay in
     `temp/` for a human.
   - Runs `../KB/scripts/gh-custom-license-incremental-update.py --apply
     --llm-review` after the `agent-skills` crawl — the same GLM adjudication
     for GitHub custom candidates.
   - Runs `../KB/scripts/clean-licenses.mjs`.
   - Syncs `licenses.json`, `licenses-index.json`, and `stats.json` into Atlas
     through `scripts/sync-license-corpus.mjs`, then refreshes the source-size
     figures via `scripts/sync-source-stats.mjs` and the README numbers via
     `scripts/update-readme-counts.mjs`.

2. **OSI License Review Tracker**
   - Runs `scripts/update-tracker.mjs`.
   - Incrementally refreshes recent `license-review` and `license-discuss`
     archives, rebuilds tracker data, verifies submitted license text records,
     and syncs `public/data/tracker.json` plus tracker indexes.

3. **OSADL checklist sidecar**
   - Runs `scripts/update-osadl.mjs`.
   - Uses OSADL timestamp gates and Atlas-side hash gates.

4. **Popular Projects sidecar**
   - Runs `scripts/update-project-showcase.mjs`.
   - Uses GitHub per-license freshness, HuggingFace parquet fingerprint, Kaggle
     Meta-Kaggle version, and Atlas-side hash gates.
   - Can be refreshed independently with `npm run update:projects`; use
     `npm run update:projects -- --source huggingface --force` when only the
     HuggingFace trending-score / likes-fallback ranking needs to be refreshed.

5. **Build verification**
   - Runs `npm run build`, which rebuilds the search index, syncs committed
     sidecars again if needed, and produces the static export.
   - The build script sets `NEXT_PRIVATE_BUILD_WORKER=0` to avoid a Next.js 16
     webpack build-worker hang observed in local and CI builds.

## Incremental Behavior

The full update is incremental by default:

- Core license sources use each crawler's local `crawl_state.json` and source
  freshness checks.
- HuggingFace trend data is a derived artifact from `models.parquet`. The
  update flow must run `hf_hub_stats_crawl.js --source license-trends` after the
  model parquet refresh; the crawler compares `source_model_etag` with the
  current models ETag and re-extracts when they differ.
- HuggingFace custom licenses are GLM-reviewed by default
  (`--llm-review`, validated 2026-08-24 against human review on real
  candidates: verdict and name extraction both matched). New custom texts are
  written to `../KB/data/hf-hub-stats/hf-custom-licenses/temp/`, adjudicated,
  and either promoted into `confirmed/` (with the official license name
  corrected by the model) or discarded with a persisted reason. Only
  schema-unresolvable candidates remain for a human.
- GitHub custom licenses follow the same GLM adjudication, but their crawler
  output lands in `../KB/data/github-stats/gh-custom-licenses/raw/`. Raw files
  and `is_standard` manifest entries are not loaded by `clean-licenses.mjs`;
  only non-standard entries present in
  `gh-custom-licenses/confirmed/manifest.json` are eligible for Atlas.
- License full-text discovery is also not treated as final on crawl alone:
  suspicious titles or ambiguous text boundaries are resolved with LLM-assisted
  review in KB before Atlas syncs newly discovered slugs.
- ScanCode LicenseDB is treated as a trusted structured source. New ScanCode
  slugs may sync automatically after `clean-licenses.mjs` has run, because the
  KB clean step already performs dedupe/merge against the existing corpus.
- Custom-license slugs present in the KB confirmed manifests (HF or GitHub —
  i.e. GLM-reviewed or human-confirmed) are auto-trusted by
  `sync-license-corpus.mjs` and sync without extra flags. Slugs from any other
  unvetted source are still blocked; after manual review, rerun with
  `--allow-new-licenses` (or `--allow-new-license <slug>` per slug).
- Tracker mail refresh defaults to recent months. Use `--since YYYY-MM`,
  `--month YYYY-MM`, or `--recent N` to adjust the OSI mail window.
- Sync scripts are hash-gated; unchanged outputs are not rewritten.

## Commands

```bash
# Full incremental update — hands-off by default (GLM auto-review for HF/GitHub
# custom candidates; confirmed slugs auto-trusted; README counts refreshed).
npm run update:data

# Restore the pre-LLM interactive manual-review flow (Finder + Enter prompts).
npm run update:data -- --interactive

# Sync new slugs that are NOT in the KB confirmed manifests (after manual
# review of blocked candidates printed by sync-license-corpus).
npm run update:data -- --allow-new-licenses

# Sync only selected reviewed slugs while leaving other unreviewed candidates
# blocked. Repeat the flag once per reviewed slug.
npm run sync:licenses -- --allow-new-license <confirmed-slug>

# Refresh from a specific OSI mail month onward.
npm run update:data -- --since 2026-06

# Rebuild/sync from existing KB data, without crawling the core license corpus.
npm run update:data -- --skip-fetch

# Skip expensive Next build while debugging data sync.
npm run update:data -- --skip-build
```

### Per-source commands

`npm run update:data` chains all of the steps below. Run one on its own for
targeted debugging or recovery. They need a local checkout of the upstream KB
repository.

| Command | Purpose |
|---|---|
| `npm run sync:licenses` | Sync the cleaned KB license corpus into Atlas |
| `npm run update:tracker` | Refresh OSI license-review and license-discuss data via KB, then sync |
| `npm run sync:tracker` | Sync already-built KB tracker data into Atlas |
| `npm run update:osadl` | Refresh OSADL checklist raw data via KB, then sync |
| `npm run sync:osadl` | Sync already-built KB OSADL checklist data into Atlas |
| `npm run update:projects` | Refresh the GitHub, HuggingFace, and Kaggle showcase data via KB, then sync |
| `npm run update:projects -- --source huggingface --force` | Refresh one showcase source only |
| `npm run sync:projects` | Sync already-built KB project-showcase data into Atlas |
| `npm run sync:stats` | Refresh the source-size figures into `src/data/source-stats.json` |

### Source-size figures

The platform sizes quoted on the About page and in the READMEs are generated, not typed in: the ScanCode LicenseDB count, the Blue Oak rating count, the GitHub license types, and the HuggingFace Hub and Meta-Kaggle snapshot sizes.

`scripts/sync-source-stats.mjs` reads the KB inputs and `src/data/stats.json` and writes each figure with its English and Chinese label to `src/data/source-stats.json`. The About page interpolates those labels, and `update-readme-counts.mjs` rewrites the README phrases that carry them. Lower-bound labels such as "3.2M+" are rounded down, so they never overstate the count.

The HuggingFace row counts are read from the parquet footers and need a Python with `pyarrow` or `polars` (`PYTHON_BIN` overrides the lookup). A figure whose input is unavailable keeps its committed value, so CI builds are unaffected. The figures only change when the KB data changes; rerunning against the same KB snapshot is a no-op.

## Local Validation

Use this sequence when changing update scripts:

```bash
node --check scripts/update-data.mjs
node --check scripts/sync-license-corpus.mjs
npm run sync:licenses
npm run update:data -- --skip-core --skip-tracker --skip-osadl --skip-projects --skip-build
npx tsc --noEmit
npm run lint
npm test
npm run build
```

For UI-affecting data changes, run a local dev server and inspect at least:

- `/`
- `/licenses/apache-2.0`
- `/tracker`

The detail page should show core license metadata, OSI Review Tracker status,
OSADL checklist data when available, and Popular Projects when a sidecar record
exists.

## Required Update Summary

Every completed data update must end with a Markdown summary table. This is
required even when the update is partially blocked, because blocked candidates
are part of the audit trail.

Use this template in the final report:

| Area | Status | Count / Change | Evidence | Notes |
|---|---|---:|---|---|
| Core license corpus | synced / blocked / unchanged | before -> after | `source_hash`, changed files | Include new, removed, merged, or blocked slugs. |
| License full-text discovery | reviewed / pending / unchanged | raw / temp / confirmed | KB paths or script output | State whether GLM auto-review ran and list unresolved candidates left in temp/. |
| HF custom licenses | reviewed / pending / unchanged | raw / merged / confirmed / blocked | manifest/temp counts | List confirmed slugs and LLM-unresolved candidates. |
| GitHub source | updated / skipped / failed | source counts or skipped reason | crawler output | Covers trends, repo counts, and agent-skills custom licenses. |
| HuggingFace source | updated / skipped / failed | parquet/list/raw/trend counts | ETags or crawler output | Include stale-list rebuilds and `license-trends` re-extraction when they happen. |
| Kaggle source | updated / skipped / failed | version / license count | cache version | Note that Kaggle contributes popularity only. |
| OSI Tracker | updated / skipped / failed | submissions/events/texts | tracker hash or build output | Include `license-review` and `license-discuss` mail windows. |
| OSADL sidecar | updated / skipped / failed | checklist count/hash | timestamp/hash | Mention checklist timestamp when available. |
| Popular Projects | updated / skipped / failed | records/hash | source fingerprints | Include GitHub/HF/Kaggle refresh scope and whether HF used `trendingScore` or likes fallback. |
| Verification | pass / fail / skipped | commands | command output summary | Include build, tests, and browser checks when relevant. |

Rules:

- Report blocked candidates explicitly; do not bury them in prose.
- If a source is intentionally skipped by freshness gates, write `skipped` with
  the gate reason.
- If browser validation is relevant but not run, write `skipped` and why.
- Prefer exact hashes, counts, and changed slugs over general statements.

## Source Of Truth

- KB remains the source of truth for crawled/raw/cleaned data.
- Atlas stores committed, deployable data snapshots under `src/data/` and
  `public/data/`.
- The legacy KB reference for core license updates is
  `../KB/docs/license-update-guide.md`; this document is the Atlas-side entry
  point that ties the core corpus and sidecars together.
