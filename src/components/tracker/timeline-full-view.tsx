"use client";

// Full-text timeline view, master-detail layout (mirrors the License Texts
// tab): left = compact message navigation (#, date, sender, subject), right
// = the selected message rendered in full (nested quotes, links, signature).
// Events without an archived body stay in the navigation with a muted badge
// and degrade to their summary in the detail pane.
import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackerParticipant, TrackerTimelineEvent, TrackerSubmission } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { MailBody } from "./mail-body";
import { rolePillClass, roleKey, roleLabel, sentimentPill, sentimentLabel, normSender } from "./tracker-pills";

export interface MailBodiesShard {
  [url: string]: { subject: string; from: string; date: string; body: string };
}

export function TimelineFullView({
  s,
  events,
  origIndexes,
  focusEventIdx,
  bodies,
  loading,
  failed,
  participants,
  onOpenText,
}: {
  s: TrackerSubmission;
  events: TrackerTimelineEvent[];
  origIndexes: number[];
  focusEventIdx: number | null;
  bodies: MailBodiesShard | null;
  loading: boolean;
  failed: boolean;
  participants: TrackerParticipant[];
  onOpenText: (textId: string | null) => void;
}) {
  const { t } = useLang();
  const [selected, setSelected] = useState<number | null>(null);
  const navRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  // sender name (normalized) → role key, from the participants list.
  const roleBySender = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of participants || []) m.set(normSender(p.name), roleKey(p.role));
    return m;
  }, [participants]);
  const senderRole = (sender?: string | null) => (sender ? roleBySender.get(normSender(sender)) : undefined);

  // A focus jump ("Timeline #N" from License Texts, or a strip-node click)
  // selects the corresponding message in the full view.
  useEffect(() => {
    if (focusEventIdx != null) setSelected(focusEventIdx);
  }, [focusEventIdx]);

  const selIdx = selected != null && origIndexes.includes(selected) ? selected : origIndexes[0] ?? null;
  const selPos = selIdx != null ? origIndexes.indexOf(selIdx) : -1;
  const selEvent = selPos >= 0 ? events[selPos] : null;
  const selBody = selEvent?.url && bodies ? bodies[selEvent.url] : null;

  const stats = useMemo(() => {
    let withBody = 0;
    for (const ev of events) if (bodies && ev.url && bodies[ev.url]) withBody++;
    return { total: events.length, withBody };
  }, [events, bodies]);

  // Keep the selected nav item visible inside the (lg) scrolling nav column.
  useEffect(() => {
    if (selIdx == null) return;
    navRefs.current[selIdx]?.scrollIntoView({ block: "nearest" });
  }, [selIdx]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-zinc-400">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-[#7c3aed]" />
        {t("tracker.fullLoading")}
      </div>
    );
  }

  const goPrev = selPos > 0 ? () => setSelected(origIndexes[selPos - 1]) : null;
  const goNext = selPos >= 0 && selPos < events.length - 1 ? () => setSelected(origIndexes[selPos + 1]) : null;

  return (
    <div className="space-y-2">
      {failed && (
        <p className="rounded-lg border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200">
          {t("tracker.fullLoadFailed")}
        </p>
      )}
      {stats.total > 0 && stats.withBody === 0 && !failed && (
        <p className="py-2 text-sm text-zinc-400">{t("tracker.fullNone")}</p>
      )}
      <div className="grid gap-3 lg:grid-cols-[minmax(200px,1fr)_minmax(0,2fr)] lg:grid-rows-[640px]">
        {/* ── Left: message navigation ── */}
        <div className="flex flex-col gap-2 lg:overflow-hidden">
          <div className="pane-scroll flex flex-col gap-1.5 pr-1 lg:min-h-0 lg:flex-1 lg:overflow-auto">
            {events.map((ev, i) => {
              const origIdx = origIndexes[i];
              const hasBody = !!(bodies && ev.url && bodies[ev.url]);
              const nav = bodies && ev.url ? bodies[ev.url] : null;
              const active = origIdx === selIdx;
              const focused = focusEventIdx === origIdx;
              return (
                <button
                  key={origIdx}
                  type="button"
                  ref={(el) => { navRefs.current[origIdx] = el; }}
                  id={`ev-${s.id}-${origIdx}`}
                  onClick={() => setSelected(origIdx)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-[#7c3aed]/50 bg-[#7c3aed]/5 dark:border-[#a78bfa]/40 dark:bg-[#a78bfa]/10"
                      : "border-zinc-200/60 hover:border-zinc-300 dark:border-zinc-800/60 dark:hover:border-zinc-700"
                  } ${focused ? "ring-2 ring-[#7c3aed]/40" : ""}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[10px] text-zinc-400">#{origIdx + 1}</span>
                    <span className="text-[10px] text-zinc-400">{ev.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      {nav?.from || ev.sender || "—"}
                    </span>
                    {(() => {
                      const role = senderRole(nav?.from || ev.sender);
                      // only badge meaningful roles, not plain participants
                      if (!role || role === "participant") return null;
                      return (
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${rolePillClass(role)}`}>
                          {roleLabel(role, t)}
                        </span>
                      );
                    })()}
                    {(() => {
                      const pill = sentimentPill(ev.type, ev.sentiment);
                      if (!pill) return null;
                      return <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${pill}`}>{sentimentLabel(ev.sentiment, t)}</span>;
                    })()}
                    {!!ev.text_ids?.length && (
                      <span className="shrink-0 rounded-full bg-cyan-50 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                        {t("tracker.text")}
                      </span>
                    )}
                  </div>
                  <div className={`truncate text-xs ${hasBody ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400/70 dark:text-zinc-500"}`}>
                    {nav?.subject || ev.subject || ev.point || ev.snippet}
                  </div>
                  {!hasBody && (
                    <div className="mt-1 text-[9px] uppercase tracking-wide text-zinc-400/80 dark:text-zinc-500">{t("tracker.fullNoBody")}</div>
                  )}
                </button>
              );
            })}
            {!events.length && <div className="text-sm text-zinc-400">{t("tracker.noEvents")}</div>}
          </div>
        </div>

        {/* ── Right: selected message detail ── */}
        <div className="min-w-0 rounded-lg border border-zinc-200/60 bg-zinc-50/70 p-3 lg:flex lg:h-full lg:flex-col dark:border-zinc-800/60 dark:bg-zinc-950/40">
          {selEvent ? (
            <>
              <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-zinc-100 pb-2 text-xs dark:border-zinc-800/70">
                <span className="font-mono text-zinc-400">#{selIdx! + 1}</span>
                <span className="text-zinc-400">{selEvent.date}</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">{selBody?.from || selEvent.sender || "—"}</span>
                {(() => {
                  const role = senderRole(selBody?.from || selEvent.sender);
                  if (!role || role === "participant") return null;
                  return (
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${rolePillClass(role)}`}>
                      {roleLabel(role, t)}
                    </span>
                  );
                })()}
                {(() => {
                  const pill = sentimentPill(selEvent.type, selEvent.sentiment);
                  if (!pill) return null;
                  return <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${pill}`}>{sentimentLabel(selEvent.sentiment, t)}</span>;
                })()}
                <span className="rounded bg-violet-50 px-1 text-[9px] dark:bg-violet-900/20">{selEvent.source}</span>
                {!!selEvent.text_ids?.length && (
                  <button
                    type="button"
                    onClick={() => onOpenText(selEvent.text_ids?.[0] || null)}
                    className="rounded bg-cyan-50 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-300"
                  >
                    {t("tracker.text")}
                  </button>
                )}
                <span className="ml-auto inline-flex items-center gap-1">
                  <button type="button" onClick={goPrev ?? undefined} disabled={!goPrev} className="rounded border border-zinc-200/60 px-1.5 py-0.5 text-[10px] text-zinc-500 disabled:opacity-30 dark:border-zinc-700/60" aria-label={t("tracker.prevMsg")}>‹</button>
                  <button type="button" onClick={goNext ?? undefined} disabled={!goNext} className="rounded border border-zinc-200/60 px-1.5 py-0.5 text-[10px] text-zinc-500 disabled:opacity-30 dark:border-zinc-700/60" aria-label={t("tracker.nextMsg")}>›</button>
                  {selEvent.url && (
                    <a href={selEvent.url} target="_blank" rel="noopener noreferrer" className="text-[#7c3aed] hover:underline dark:text-[#a78bfa]">
                      {t("tracker.sourceLink")}
                    </a>
                  )}
                </span>
              </div>
              <p className="mb-2 shrink-0 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{selBody?.subject || selEvent.subject}</p>
              <div className="pane-scroll lg:min-h-0 lg:flex-1 lg:overflow-auto">
                {selBody ? (
                  <MailBody body={selBody.body} />
                ) : (
                  <div>
                    <p className="mb-2 inline-block rounded border border-dashed border-zinc-300 px-1.5 py-0.5 text-[10px] text-zinc-400 dark:border-zinc-700">{t("tracker.fullNoBody")}</p>
                    <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">{selEvent.point || selEvent.snippet}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm text-zinc-400">{t("tracker.noEvents")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
