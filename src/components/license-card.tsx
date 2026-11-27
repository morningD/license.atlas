// SPDX-License-Identifier: MulanPSL-2.0

"use client";

import Link from "next/link";
import { Badge } from "./badge";
import { useLang } from "@/lib/i18n";
import type { License } from "@/lib/types";

interface LicenseCardProps {
  license: Pick<License, "slug" | "title" | "spdx_id" | "type" | "osi_approved" | "fsf_libre" | "fsf_tags" | "tags" | "description" | "trend">;
  reviewTracked?: boolean;
}

function Sparkline({ data }: { data: number[] }) {
  const W = 80, H = 30, PAD_X = 2, PAD_Y = 5;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: PAD_X + (i / (data.length - 1)) * (W - PAD_X * 2),
    y: PAD_Y + (1 - (v - min) / range) * (H - PAD_Y * 2),
  }));

  // Catmull-Rom → cubic Bézier for smooth curves
  const tension = 0.3;
  let linePath = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    linePath += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  const areaPath = `${linePath} L${points[points.length - 1].x},${H} L${points[0].x},${H} Z`;
  const id = `spark-${points.map((p) => `${p.x|0}${p.y|0}`).join("").slice(0, 8)}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id}-fill)`} />
      <path d={linePath} fill="none" stroke={`url(#${id}-line)`} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LicenseCard({ license, reviewTracked = false }: LicenseCardProps) {
  const { t } = useLang();

  return (
    <Link
      href={`/licenses/${license.slug}`}
      prefetch={false}
      onMouseEnter={() => {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = `/license.atlas/licenses/${license.slug}`;
        document.head.appendChild(link);
      }}
      className="license-card group relative flex flex-col gap-3 overflow-visible rounded-2xl p-5"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-zinc-950 group-hover:text-[#7c3aed] dark:text-zinc-50 dark:group-hover:text-[#a78bfa]">
            {license.title}
          </h3>
          {license.trend && license.trend.length > 1 && <Sparkline data={license.trend} />}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          {license.spdx_id && (
            <code className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {license.spdx_id}
            </code>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {license.type !== "terms" && <Badge variant="type" themeKey={license.type}>{t(`type.${license.type}`)}</Badge>}
        {license.osi_approved && <Badge variant="osi">{t("badge.osiApproved")}</Badge>}
        {license.fsf_libre && <Badge variant="fsf">{t("badge.fsfLibre")}</Badge>}
        {(license.fsf_tags || []).filter((ft) => ft !== "libre" && ft !== "non-free").map((tag) => {
          const tagKey = `tag.${tag}`;
          const translated = t(tagKey) !== tagKey ? t(tagKey) : tag.replace(/gpl|fdl/g, (m) => m.toUpperCase());
          return <Badge key={tag} variant="fsf-tag" themeKey={tag}>{translated}</Badge>;
        })}
        {license.tags.filter((tag) => license.type === "terms" || tag !== "Terms").map((tag) => {
          const tagKey = `tag.${tag.toLowerCase().replace(/ /g, "-").replace(/[^a-z0-9-]/g, "")}`;
          const translated = t(tagKey) !== tagKey ? t(tagKey) : tag;
          return <Badge key={tag} variant={tag === "tl;drLegal Verified" ? "verified" : "tag"} themeKey={tag}>{translated}</Badge>;
        })}
        {reviewTracked && <Badge variant="tag" themeKey="review-tracked">{t("tag.review-tracked")}</Badge>}
      </div>
    </Link>
  );
}
