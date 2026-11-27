// SPDX-License-Identifier: MulanPSL-2.0

"use client";

import { useState, useCallback, useEffect } from "react";
import { CcLangNav } from "@/components/cc-family-nav";
import { LicenseBody } from "./license-body-renderer";
import { useLang } from "@/lib/i18n";

interface LicenseBodySectionProps {
  slug: string;
  body: string;
  hasBodies?: boolean;
}

function CopyButton({ text }: { text: string }) {
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

const bodyCache = new Map<string, { lang: string; body: string }[]>();

export function LicenseBodySection({ slug, body, hasBodies }: LicenseBodySectionProps) {
  const { t } = useLang();
  const [activeBody, setActiveBody] = useState(body);
  const [bodies, setBodies] = useState<{ lang: string; body: string }[] | null>(null);

  useEffect(() => {
    if (!hasBodies) return;
    const cached = bodyCache.get(slug);
    if (cached) { setBodies(cached); return; }
    fetch(`${window.location.origin}/license.atlas/data/cc-bodies/${slug}.json`)
      .then((r) => r.json())
      .then((data) => {
        // Prepend English (the page's default body) so language switcher includes it
        const allBodies = [{ lang: "en", body }, ...data];
        bodyCache.set(slug, allBodies);
        setBodies(allBodies);
      })
      .catch(() => {});
  }, [slug, body, hasBodies]);

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          {t("body.fullText")}
        </h2>
        <CopyButton text={activeBody} />
      </div>
      {bodies && bodies.length > 1 && (
        <CcLangNav bodies={bodies} onSelect={setActiveBody} />
      )}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <LicenseBody text={activeBody} />
      </div>
    </div>
  );
}
