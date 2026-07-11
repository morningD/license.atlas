"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/lib/i18n";
import { subscribeToSiteViewCount } from "@/lib/page-counter";
import stats from "@/data/stats.json";
import trackerMeta from "@/data/tracker-meta.json";
import osadlMeta from "@/data/osadl-meta.json";

export function Footer() {
  const { t, lang } = useLang();
  const [mounted, setMounted] = useState(false);
  const [siteViewCount, setSiteViewCount] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    return subscribeToSiteViewCount(setSiteViewCount);
  }, []);

  const brandName = mounted && lang === "zh"
    ? <span className="font-serif tracking-widest"><span className="font-medium text-[#7c3aed]">许可</span>图鉴</span>
    : <><span className="font-medium text-[#7c3aed]">License</span>Atlas</>;
  const statsUpdated = new Date(`${stats.updated}T00:00:00Z`);
  const trackerUpdated = new Date(trackerMeta.generated_at);
  const osadlUpdated = new Date(osadlMeta.generated_at);
  const latestUpdated = [statsUpdated, trackerUpdated, osadlUpdated]
    .reduce((latest, current) => current > latest ? current : latest);
  const updatedLabel = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(latestUpdated);

  return (
    <footer className="mt-auto border-t border-zinc-200 py-8 dark:border-zinc-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 text-sm text-zinc-500 sm:flex-row">
          <p>{brandName}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-zinc-400 sm:justify-end">
            <p>{t("footer.dataUpdatedAt", { date: updatedLabel })}</p>
            <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">|</span>
            <p className="flex items-center gap-1">
              <span className="font-mono">{siteViewCount?.toLocaleString() ?? "-"}</span> {t("footer.views")}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-1 text-center text-xs leading-relaxed text-zinc-400 dark:text-zinc-500 sm:text-left">
          <p>
            {t("footer.copyrightPrefix")}{" "}
            <a
              href="https://faculty.ecnu.edu.cn/_s37/dmm/main.psp"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-500 underline-offset-2 hover:text-[#7c3aed] hover:underline dark:text-zinc-400 dark:hover:text-[#a78bfa]"
            >
              {t("footer.copyrightName")}
            </a>
            {t("footer.copyrightSuffix")}
          </p>
          <p>{t("footer.licenseNotice")}</p>
        </div>
      </div>
    </footer>
  );
}
