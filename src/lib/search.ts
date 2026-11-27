import MiniSearch from "minisearch";
import type { TrackerIndex, TrackerIndexEntry, TrackerStatus } from "@/lib/types";

export type SearchGroup = {
  key: string;
  results: SearchResult[];
};

export type SearchResult = {
  kind?: "license" | "tracker";
  slug: string;
  title: string;
  spdx_id: string;
  type: string;
  score: number;
  status?: TrackerStatus;
  submitter?: string;
  messages?: number;
  firstSubmitted?: string;
  decisionDate?: string;
};

type RawResult = { id: string; slug: string; title: string; spdx_id: string; type: string; score: number };
type TrackerSearchResult = TrackerIndexEntry & { score: number };

const INDEX_URL = "/license.atlas/search-index.json";

const indexOptions = {
  fields: ["title", "spdx_id", "sources", "description", "body"],
  storeFields: ["slug", "title", "spdx_id", "type"],
  idField: "slug",
};

let miniSearch: MiniSearch | null = null;
let loading: Promise<MiniSearch> | null = null;
let trackerLoading: Promise<TrackerIndexEntry[]> | null = null;
let trackerEntryCache: TrackerIndexEntry[] | null = null;

function loadIndex(): Promise<MiniSearch> {
  if (miniSearch) return Promise.resolve(miniSearch);
  if (loading) return loading;

  loading = fetch(INDEX_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`Search index fetch failed: ${r.status}`);
      return r.text();
    })
    .then((json) => {
      miniSearch = MiniSearch.loadJSON(json, indexOptions);
      return miniSearch;
    });
  // A rejected in-flight promise must not be cached: without this reset a
  // single failed fetch (transient network error) would make every later
  // search reuse the same rejection until the page is reloaded. Concurrent
  // callers above still share the in-flight promise; only the next call
  // after a failure retries.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

export function preloadIndex() {
  loadIndex().catch(() => {});
}

function normalizeIdentifier(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function identifierBoost(query: string, result: RawResult) {
  const q = normalizeIdentifier(query);
  if (!q) return 0;

  const slug = normalizeIdentifier(result.slug || "");
  const spdx = normalizeIdentifier(result.spdx_id || "");
  const title = normalizeIdentifier(result.title || "");

  // SPDX ids and slugs are what users usually mean when typing identifiers
  // such as "CC-BY-SA". Prefer exact/prefix identifier matches over generic
  // token matches ("cc", "by", "sa") from title/body text.
  if (spdx === q || slug === q) return 10000;
  if (spdx.startsWith(q) || slug.startsWith(q)) return 7000;
  if (spdx.includes(q) || slug.includes(q)) return 4000;
  if (title.includes(q)) return 1000;
  return 0;
}

function rankResults(query: string, raw: RawResult[]) {
  return [...raw]
    .map((r) => ({ ...r, score: r.score + identifierBoost(query, r) }))
    .sort((a, b) => b.score - a.score);
}

function buildTrackerEntries(idx: TrackerIndex): TrackerIndexEntry[] {
  const seen = new Set<string>();
  return Object.entries(idx)
    .filter(([key]) => key !== "_meta")
    .map(([, value]) => value as TrackerIndexEntry)
    .filter((entry) => entry.has_timeline || entry.has_vote)
    .filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
}

async function trackerEntries(): Promise<TrackerIndexEntry[]> {
  if (trackerEntryCache) return trackerEntryCache;
  if (trackerLoading) return trackerLoading;

  trackerLoading = import("@/data/tracker-index.json").then((mod) => {
    trackerEntryCache = buildTrackerEntries(mod.default as unknown as TrackerIndex);
    return trackerEntryCache;
  });
  return trackerLoading;
}

function trackerScore(query: string, entry: TrackerIndexEntry) {
  const q = query.trim().toLowerCase();
  const nq = normalizeIdentifier(q);
  if (!q || !nq) return 0;

  const hay = [
    entry.name,
    entry.id,
    entry.spdx_id,
    entry.submitter,
    entry.status,
  ].filter(Boolean).join(" ").toLowerCase();
  const identifiers = [entry.id, entry.spdx_id, entry.name].map((v) => normalizeIdentifier(v || ""));

  let score = 0;
  if (identifiers.some((v) => v === nq)) score += 10000;
  else if (identifiers.some((v) => v.startsWith(nq))) score += 7000;
  else if (identifiers.some((v) => v.includes(nq))) score += 4000;
  if (entry.name.toLowerCase().includes(q)) score += 1200;
  if ((entry.spdx_id || "").toLowerCase().includes(q)) score += 1000;
  if (entry.id.toLowerCase().includes(q)) score += 900;
  if ((entry.submitter || "").toLowerCase().includes(q)) score += 350;
  if (hay.includes(q)) score += 150;
  return score;
}

async function searchTracker(query: string, licenseSeen: Set<string>): Promise<TrackerSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const entries = await trackerEntries();
  return entries
    .map((entry) => ({ ...entry, score: trackerScore(q, entry) }))
    .filter((entry) => entry.score > 0)
    // If the same reviewed license already appears as a formal Atlas result,
    // avoid duplicating it in the tracker-only group. Tracker-only pending or
    // rejected submissions still appear here because they are not in Atlas.
    .filter((entry) => {
      const candidates = [entry.id, entry.spdx_id].map((v) => normalizeIdentifier(v || "")).filter(Boolean);
      return !candidates.some((v) => licenseSeen.has(v));
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

export async function searchLicenses(
  query: string
): Promise<SearchGroup[]> {
  const ms = await loadIndex();
  const q = query.trim();
  if (!q) return [];

  const nameResults = ms.search(q, {
    fields: ["title", "spdx_id"],
    boost: { title: 10, spdx_id: 8 },
    prefix: true,
    combineWith: "OR",
  }) as unknown as RawResult[];

  const sourceResults = ms.search(q, {
    fields: ["sources"],
    boost: { sources: 5 },
    prefix: true,
    combineWith: "OR",
  }) as unknown as RawResult[];

  const fulltextResults = ms.search(q, {
    fields: ["body", "description"],
    boost: { description: 3, body: 1 },
    prefix: true,
    combineWith: "OR",
  }) as unknown as RawResult[];

  const fuzzyResults = ms.search(q, {
    fields: ["title", "spdx_id", "sources", "description", "body"],
    boost: { title: 10, spdx_id: 8, sources: 5, description: 3, body: 1 },
    fuzzy: 0.2,
    prefix: true,
    combineWith: "OR",
  }) as unknown as RawResult[];

  const seen = new Set<string>();
  const groups: SearchGroup[] = [];

  function addGroup(key: string, raw: RawResult[]) {
    const deduped = rankResults(q, raw).filter((r) => !seen.has(r.id));
    deduped.forEach((r) => seen.add(r.id));
    if (deduped.length > 0) {
      groups.push({
        key,
        results: deduped.map((r) => ({
          kind: "license",
          slug: r.slug,
          title: r.title,
          spdx_id: r.spdx_id,
          type: r.type,
          score: r.score,
        })),
      });
    }
  }

  addGroup("name", nameResults);
  addGroup("source", sourceResults);
  addGroup("fulltext", fulltextResults);
  addGroup("fuzzy", fuzzyResults);

  const licenseIdentifiers = new Set<string>();
  for (const id of seen) licenseIdentifiers.add(normalizeIdentifier(id));
  for (const group of groups) {
    for (const result of group.results) {
      licenseIdentifiers.add(normalizeIdentifier(result.slug));
      licenseIdentifiers.add(normalizeIdentifier(result.spdx_id));
      licenseIdentifiers.add(normalizeIdentifier(result.title));
    }
  }

  const trackerResults = await searchTracker(q, licenseIdentifiers);
  if (trackerResults.length > 0) {
    groups.push({
      key: "tracker",
      results: trackerResults.map((entry) => ({
        kind: "tracker",
        slug: entry.id,
        title: entry.name,
        spdx_id: entry.spdx_id,
        type: "tracker",
        score: entry.score,
        status: entry.status,
        submitter: entry.submitter,
        messages: entry.stats?.total_messages,
        firstSubmitted: entry.review_dates?.first_submitted || entry.timeline_meta?.first || undefined,
        decisionDate: entry.review_dates?.decision || undefined,
      })),
    });
  }

  return groups;
}
