"use client";

import { useLang } from "@/lib/i18n";
import type { TrackerParticipant } from "@/lib/types";
import { rolePillClass, roleLabel } from "./tracker-pills";

export function ParticipantsList({ participants }: { participants: TrackerParticipant[] }) {
  const { t } = useLang();
  if (!participants.length) return <div className="text-sm text-zinc-400">{t("tracker.noParticipants")}</div>;
  return (
    <div className="flex flex-wrap gap-2">
      {participants.map((p, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/60 bg-white/60 px-2.5 py-1 text-xs dark:border-zinc-700/60 dark:bg-zinc-900/40"
        >
          <span className="font-medium text-zinc-700 dark:text-zinc-200">{p.name}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${rolePillClass(p.role)}`}>
            {roleLabel(p.role, t)}
          </span>
          <span className="font-mono text-zinc-400">{p.message_count}</span>
        </span>
      ))}
    </div>
  );
}
