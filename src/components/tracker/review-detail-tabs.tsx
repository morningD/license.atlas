"use client";

import { useCallback, useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { formatTrackerDate } from "@/lib/tracker-date";
import type { TrackerSubmission } from "@/lib/types";
import { ParticipantsList } from "./participants-list";
import { BoardVoteCard } from "./board-vote-card";

type DetailTab = "timeline" | "participants" | "texts" | "vote";
const TEXT_SERIES_ORDER = ["MG0", "MG-BY", "MG-BY-OS", "MG-BY-SA"];

// Sentiment → small colored pill, mirroring the timeline-strip sentiment tint.
// Only feedback events carry a meaningful sentiment; non-feedback or neutral → no pill.
const SENT_PILL: Record<string, string> = {
  positive: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  support: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  negative: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  oppose: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  question: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  mixed: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

function sentimentPill(type: string, sentiment?: string | null): string | null {
  if (!sentiment || type !== "feedback") return null;
  const s = sentiment.toLowerCase();
  return SENT_PILL[s] || null;
}

function sourceLabel(source: string, t: (key: string) => string): string {
  if (source === "license-discuss") return t("tracker.source-discuss");
  if (source === "osi_api") return t("tracker.source-api");
  return t("tracker.source-review");
}

function confidenceClass(confidence?: string) {
  if (confidence === "high") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (confidence === "medium") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  if (confidence === "low") return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
}

function confidenceLabel(confidence: string | undefined, t: (key: string) => string) {
  if (!confidence) return "";
  const key = `tracker.confidence-${confidence}`;
  const translated = t(key);
  return translated !== key ? translated : confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

function confidenceTitle(confidence: string | undefined, t: (key: string) => string) {
  const key = confidence ? `tracker.confidenceTitle-${confidence}` : "tracker.confidenceTitle-default";
  const translated = t(key);
  return translated !== key ? translated : t("tracker.confidenceTitle-default");
}

function eventTypeLabel(type: string, t: (key: string) => string) {
  const key = `tracker.type-${type}`;
  const translated = t(key);
  return translated !== key ? translated : type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function sentimentLabel(sentiment: string | undefined | null, t: (key: string) => string) {
  if (!sentiment) return "";
  const key = `tracker.sentiment-${sentiment.toLowerCase()}`;
  const translated = t(key);
  return translated !== key ? translated : sentiment;
}

function seriesLabel(series: string, t: (key: string) => string) {
  return series === "Other" ? t("tracker.seriesOther") : series;
}

function diffLineClass(type: string) {
  if (type === "add") return "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  if (type === "remove") return "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200";
  return "text-zinc-600 dark:text-zinc-300";
}

function diffLinePrefix(type: string) {
  if (type === "add") return "+";
  if (type === "remove") return "-";
  return " ";
}

function TrackerCopyButton({ text }: { text: string }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      title={t("body.copyTooltip")}
    >
      {copied ? (
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {t("body.copied")}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          {t("body.copy")}
        </span>
      )}
    </button>
  );
}

export function ReviewDetailTabs({
  s, tab, setTab, src, setSrc, focusEventIdx, focusTimelineEvent, clearFocus,
}: {
  s: TrackerSubmission;
  tab: DetailTab;
  setTab: (t: DetailTab) => void;
  src: "review" | "discuss" | "all";
  setSrc: (s: "review" | "discuss" | "all") => void;
  focusEventIdx: number | null;
  focusTimelineEvent: (idx: number) => void;
  clearFocus: () => void;
}) {
  const { lang, t } = useLang();
  const timeline = useMemo(() => s.timeline || [], [s.timeline]);
  const discussCount = timeline.filter((e) => e.source === "license-discuss").length;
  const reviewCount = timeline.length - discussCount;

  const hasVote = !!s.board_vote;
  const texts = useMemo(() => s.license_texts || [], [s.license_texts]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [textView, setTextView] = useState<"text" | "diff">("text");
  const [textSeries, setTextSeries] = useState<string>("all");
  const seriesCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of texts) {
      const key = tx.series || "Other";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => {
      const ai = TEXT_SERIES_ORDER.indexOf(a);
      const bi = TEXT_SERIES_ORDER.indexOf(b);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.localeCompare(b);
    });
  }, [texts]);
  const hasSeriesFilter = seriesCounts.length > 1;
  const filteredTexts = useMemo(
    () => textSeries === "all" ? texts : texts.filter((tx) => (tx.series || "Other") === textSeries),
    [texts, textSeries],
  );
  const selectedText = useMemo(
    () => filteredTexts.find((tx) => tx.id === selectedTextId) || filteredTexts.find((tx) => !tx.duplicate_of) || filteredTexts[0] || texts[0],
    [filteredTexts, selectedTextId, texts],
  );
  const selectedDiff = useMemo(
    () => (s.license_text_diffs || []).find((d) => d.to_text_id === selectedText?.id) || null,
    [s.license_text_diffs, selectedText?.id],
  );
  const selectedTextBody = selectedText?.display_text || selectedText?.text || selectedText?.content_preview || selectedText?.filename || "";
  const filtered = useMemo(
    () =>
      timeline.filter((e) =>
        src === "all" ? true : src === "discuss" ? e.source === "license-discuss" : e.source !== "license-discuss"
      ),
    [timeline, src],
  );
  // Map filtered index → original timeline index so strip-node clicks (original idx) match rows.
  const filteredOrigIdx = useMemo(
    () =>
      timeline.map((_, i) => i).filter((i) => {
        const e = timeline[i];
        return src === "all" ? true : src === "discuss" ? e.source === "license-discuss" : e.source !== "license-discuss";
      }),
    [timeline, src],
  );

  return (
    <div className="mt-4 border-t border-zinc-200/60 pt-4 dark:border-zinc-800/60">
      <div className="mb-4 flex gap-1 border-b border-zinc-200/60 dark:border-zinc-800/60">
        {([
          ["timeline", `${t("tracker.tabTimeline")} (${timeline.length})`],
          ["participants", `${t("tracker.tabParticipants")} (${s.participants.length})`],
          ...(texts.length ? [["texts", `${t("tracker.tabTexts")} (${texts.length})`] as const] : []),
          ...(hasVote ? [["vote", t("tracker.tabVote")] as const] : []),
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setTab(k as DetailTab); if (k !== "timeline") clearFocus(); }}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === k ? "border-[#7c3aed] text-[#7c3aed] dark:text-[#a78bfa]" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "timeline" && (
        <div>
          <div className="mb-3 flex gap-1.5">
            {reviewCount > 0 && (
              <button onClick={() => setSrc("review")} className={`rounded-full px-2.5 py-1 text-xs ${src === "review" ? "bg-[#7c3aed] text-white" : "border border-zinc-200/60 dark:border-zinc-700/60"}`}>{t("tracker.review")} ({reviewCount})</button>
            )}
            {discussCount > 0 && (
              <button onClick={() => setSrc("discuss")} className={`rounded-full px-2.5 py-1 text-xs ${src === "discuss" ? "bg-[#7c3aed] text-white" : "border border-zinc-200/60 dark:border-zinc-700/60"}`}>{t("tracker.discuss")} ({discussCount})</button>
            )}
            <button onClick={() => setSrc("all")} className={`rounded-full px-2.5 py-1 text-xs ${src === "all" ? "bg-[#7c3aed] text-white" : "border border-zinc-200/60 dark:border-zinc-700/60"}`}>{t("tracker.all")} ({timeline.length})</button>
          </div>
          <div className="flex max-h-[560px] flex-col gap-1 overflow-auto pr-1">
            {filtered.map((ev, i) => {
              const origIdx = filteredOrigIdx[i];
              const focused = focusEventIdx === origIdx;
              const sentPill = sentimentPill(ev.type, ev.sentiment);
              return (
                <div
                  key={i}
                  id={`ev-${s.id}-${origIdx}`}
                  className={`grid grid-cols-[80px_1fr] gap-2 rounded-md px-1 py-0.5 text-sm ${focused ? "ring-2 ring-[#7c3aed]/40" : ""}`}
                >
                  <span className="text-xs text-zinc-400">{formatTrackerDate(ev.date)}</span>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {eventTypeLabel(ev.type, t)}
                      <span className="ml-1.5 rounded bg-violet-50 px-1 text-[9px] dark:bg-violet-900/20">{sourceLabel(ev.source, t)}</span>
                      {sentPill && (
                        <span className={`ml-1.5 rounded px-1 text-[9px] ${sentPill}`}>{sentimentLabel(ev.sentiment, t)}</span>
                      )}
                      {!!ev.text_ids?.length && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const textId = ev.text_ids?.[0] || null;
                            const linkedText = texts.find((tx) => tx.id === textId);
                            setSelectedTextId(textId);
                            if (hasSeriesFilter) setTextSeries(linkedText?.series || "Other");
                            setTextView("text");
                            setTab("texts");
                            clearFocus();
                          }}
                          className="ml-1.5 rounded bg-cyan-50 px-1 text-[9px] text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-900/50"
                        >
                          {t("tracker.text")}
                        </button>
                      )}
                    </div>
                    {ev.sender && ev.sender !== "Unknown" && <span className="font-medium">{ev.sender}: </span>}
                    <span className="text-zinc-600 dark:text-zinc-300">{(lang === "zh" ? ev.point_zh || ev.snippet : ev.snippet) || ev.subject?.slice(0, 100)}</span>
                    {ev.url && <a href={ev.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="ml-1 inline-flex shrink-0 whitespace-nowrap text-xs text-[#7c3aed] hover:underline dark:text-[#a78bfa]">{t("tracker.sourceLink")}</a>}
                  </div>
                </div>
              );
            })}
            {!filtered.length && <div className="text-sm text-zinc-400">{t("tracker.noEvents")}</div>}
          </div>
        </div>
      )}

      {tab === "participants" && <ParticipantsList participants={s.participants} />}

      {tab === "texts" && (
        <div className="space-y-3">
          <p className="rounded-lg border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200">
            {t("tracker.licenseTextNotice")}
          </p>
          <div className="grid gap-3 lg:grid-cols-[minmax(200px,1fr)_minmax(0,2fr)]">
            <div className="flex flex-col gap-2 lg:max-h-[560px] lg:overflow-hidden">
            {hasSeriesFilter && (
              <div className="flex flex-wrap gap-1.5 pr-1">
                <button
                  type="button"
                  onClick={() => { setTextSeries("all"); setSelectedTextId(null); setTextView("text"); }}
                  className={`rounded-full px-2.5 py-1 text-xs ${textSeries === "all" ? "bg-[#7c3aed] text-white" : "border border-zinc-200/60 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700/60 dark:text-zinc-300"}`}
                >
                  {t("tracker.all")} ({texts.length})
                </button>
                {seriesCounts.map(([series, count]) => (
                  <button
                    key={series}
                    type="button"
                    onClick={() => { setTextSeries(series); setSelectedTextId(null); setTextView("text"); }}
                    className={`rounded-full px-2.5 py-1 text-xs ${textSeries === series ? "bg-cyan-600 text-white" : "border border-zinc-200/60 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700/60 dark:text-zinc-300"}`}
                  >
                    {seriesLabel(series, t)} ({count})
                  </button>
                ))}
              </div>
            )}
            <div className="pane-scroll flex flex-col gap-1.5 pr-1 lg:min-h-0 lg:flex-1 lg:overflow-auto">
            {filteredTexts.map((tx, i) => {
              const active = (selectedText?.id || filteredTexts[0]?.id) === tx.id;
              return (
                <button
                  key={tx.id || i}
                  type="button"
                  onClick={() => {
                    setSelectedTextId(tx.id || null);
                    setTextView("text");
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? "border-[#7c3aed]/50 bg-violet-50 dark:border-[#a78bfa]/50 dark:bg-violet-950/30"
                      : "border-zinc-200/60 bg-white hover:border-zinc-300 dark:border-zinc-800/60 dark:bg-zinc-950/30 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {tx.date && <span className="text-xs text-zinc-400">{formatTrackerDate(tx.date)}</span>}
                    {tx.series && <span className="rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">{seriesLabel(tx.series, t)}</span>}
                    {(tx.version_label || tx.version) && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">v{tx.version_label || tx.version}</span>}
                    {tx.revision_label && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{tx.revision_label}</span>}
                    {tx.duplicate_of && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{t("tracker.duplicate")}</span>}
                  </div>
                  <div className="mt-1 line-clamp-2 font-medium text-zinc-800 dark:text-zinc-100">{tx.title || tx.filename}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <span>{(tx.size / 1024).toFixed(1)}KB</span>
                    {Number.isInteger(tx.event_index) && <span>{t("tracker.timelineRef", { n: (tx.event_index || 0) + 1 })}</span>}
                    {tx.extraction_confidence && (
                      <span
                        className={`rounded px-1.5 py-0.5 ${confidenceClass(tx.extraction_confidence)}`}
                        title={confidenceTitle(tx.extraction_confidence, t)}
                      >
                        {confidenceLabel(tx.extraction_confidence, t)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            </div>
          </div>

            <div className="min-w-0 rounded-lg border border-zinc-200/60 bg-zinc-50/70 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/40">
            {selectedText ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-100">{selectedText.title || selectedText.filename}</span>
                  {selectedText.sha256 && <span className="font-mono">{selectedText.sha256.slice(0, 12)}</span>}
                  {selectedText.message_url && (
                    <a href={selectedText.message_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex shrink-0 whitespace-nowrap text-[#7c3aed] hover:underline dark:text-[#a78bfa]">{t("tracker.sourceLink")}</a>
                  )}
                  {Number.isInteger(selectedText.event_index) && (
                    <button
                      type="button"
                      onClick={() => focusTimelineEvent(selectedText.event_index || 0)}
                      className="inline-flex shrink-0 whitespace-nowrap text-[#7c3aed] hover:underline dark:text-[#a78bfa]"
                    >
                      {t("tracker.timelineRef", { n: (selectedText.event_index || 0) + 1 })}
                    </button>
                  )}
                  <span className="ml-auto">
                    <TrackerCopyButton text={selectedTextBody} />
                  </span>
                </div>
                <div className="mb-2 flex gap-1.5">
                  <button type="button" onClick={() => setTextView("text")} className={`rounded-full px-2.5 py-1 text-xs ${textView === "text" ? "bg-[#7c3aed] text-white" : "border border-zinc-200/60 dark:border-zinc-700/60"}`}>{t("tracker.text")}</button>
                  <button type="button" onClick={() => setTextView("diff")} disabled={!selectedDiff} className={`rounded-full px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${textView === "diff" ? "bg-[#7c3aed] text-white" : "border border-zinc-200/60 dark:border-zinc-700/60"}`}>
                    {t("tracker.diffFromPrevious")}{selectedDiff ? ` (+${selectedDiff.stats.added}/-${selectedDiff.stats.removed})` : ""}
                  </button>
                </div>
                {textView === "diff" && selectedDiff ? (
                  <div className="pane-scroll overflow-auto rounded-md bg-white p-3 font-mono text-xs leading-relaxed lg:max-h-[560px] dark:bg-zinc-950">
                    <div className="mb-2 font-sans text-xs text-zinc-500">
                      {selectedDiff.from_label} → {selectedDiff.to_label}
                      {selectedDiff.truncated && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{t("tracker.truncated")}</span>}
                    </div>
                    {selectedDiff.too_large ? (
                      <div className="text-zinc-500">{t("tracker.diffTooLarge")}</div>
                    ) : selectedDiff.hunks.length ? (
                      selectedDiff.hunks.map((hunk, hunkIdx) => (
                        <div key={hunkIdx} className="mb-3 overflow-hidden rounded border border-zinc-100 dark:border-zinc-800">
                          <div className="bg-zinc-100 px-2 py-1 text-[10px] text-zinc-500 dark:bg-zinc-900">@@ {hunk.old_start} / {hunk.new_start} @@</div>
                          {hunk.lines.map((line, lineIdx) => (
                            <div key={lineIdx} className={`grid grid-cols-[18px_1fr] gap-2 px-2 py-0.5 ${diffLineClass(line.type)}`}>
                              <span>{diffLinePrefix(line.type)}</span>
                              <span className="whitespace-pre-wrap break-words">{line.text || " "}</span>
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      <div className="text-zinc-500">{t("tracker.noTextChanges")}</div>
                    )}
                  </div>
                ) : (
                  <pre className="pane-scroll overflow-auto whitespace-pre-wrap break-words rounded-md bg-white p-3 font-mono text-xs leading-relaxed text-zinc-700 lg:max-h-[560px] dark:bg-zinc-950 dark:text-zinc-200">
                    {selectedTextBody}
                  </pre>
                )}
              </>
            ) : (
              <div className="text-sm text-zinc-400">{t("tracker.noLicenseTexts")}</div>
            )}
            </div>
          </div>
        </div>
      )}

      {tab === "vote" && hasVote && s.board_vote && <BoardVoteCard v={s.board_vote} status={s.status} />}
    </div>
  );
}
