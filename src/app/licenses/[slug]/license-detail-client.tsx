// SPDX-License-Identifier: MulanPSL-2.0

"use client";

import Link from "next/link";
import { Badge } from "@/components/badge";
import { LicenseBodySection } from "@/components/license-body-section";
import { ProjectShowcaseBlock } from "@/components/project-showcase-block";
import { LicenseReviewBlock } from "@/components/license-review-block";
import { OsadlChecklistBlock } from "@/components/osadl-checklist-block";
import { useLang } from "@/lib/i18n";
import { osadlMeta, resolveOsadlChecklist } from "@/lib/osadl";
import { resolveProjectShowcase } from "@/lib/project-showcase";
import { hasReviewContent, resolveTrackerEntry } from "@/lib/tracker-match";
import type { License } from "@/lib/types";

const LANG_NAMES_EN: Record<string, string> = {
  en: "English", zh: "Chinese", "zh-hans": "Chinese (Simplified)", "zh-hant": "Chinese (Traditional)",
  ja: "Japanese", ko: "Korean", ar: "Arabic", de: "German", es: "Spanish", fr: "French",
  it: "Italian", pt: "Portuguese", ru: "Russian", nl: "Dutch", pl: "Polish",
  tr: "Turkish", sv: "Swedish", da: "Danish", no: "Norwegian", fi: "Finnish",
  el: "Greek", cs: "Czech", sk: "Slovak", sl: "Slovenian", hr: "Croatian",
  ro: "Romanian", hu: "Hungarian", uk: "Ukrainian", et: "Estonian", lv: "Latvian",
  lt: "Lithuanian", id: "Indonesian", eu: "Basque", fy: "Frisian", mi: "Maori",
};

const LANG_NAMES_ZH: Record<string, string> = {
  en: "英语", zh: "中文", "zh-hans": "简体中文", "zh-hant": "繁体中文",
  ja: "日语", ko: "韩语", ar: "阿拉伯语", de: "德语", es: "西班牙语", fr: "法语",
  it: "意大利语", pt: "葡萄牙语", ru: "俄语", nl: "荷兰语", pl: "波兰语",
  tr: "土耳其语", sv: "瑞典语", da: "丹麦语", no: "挪威语", fi: "芬兰语",
  el: "希腊语", cs: "捷克语", sk: "斯洛伐克语", sl: "斯洛文尼亚语", hr: "克罗地亚语",
  ro: "罗马尼亚语", hu: "匈牙利语", uk: "乌克兰语", et: "爱沙尼亚语", lv: "拉脱维亚语",
  lt: "立陶宛语", id: "印尼语", eu: "巴斯克语", fy: "弗里斯兰语", mi: "毛利语",
};

function formatLanguages(languages: string[], lang: string): string[] {
  if (!languages || languages.length === 0) return [];
  if (languages.length === 1 && languages[0] === "en") return [];
  if (languages.length > 2) return [lang === "zh" ? "多语言" : "Multilingual"];
  const names = lang === "zh" ? LANG_NAMES_ZH : LANG_NAMES_EN;
  return languages.map((l) => names[l] || l);
}

interface Props {
  license: License;
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}

export function LicenseDetailClient({ license, prev, next }: Props) {
  const { t, lang } = useLang();
  const trackerEntry = resolveTrackerEntry(license);
  const reviewTracked = !!trackerEntry && hasReviewContent(trackerEntry);
  const osadlEntry = resolveOsadlChecklist(license);
  const showcaseEntry = resolveProjectShowcase(license);
  const hasShowcase = !!showcaseEntry;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className={hasShowcase ? "gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem]" : "mx-auto max-w-4xl"}>
        <div className="min-w-0">
      {/* Nav */}
      <Link
        href="/"
        className="detail-enter mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-[#7c3aed] dark:hover:text-[#a78bfa]"
      >
        &larr; {t("detail.allLicenses")}
      </Link>

      {/* Header */}
      <div className="detail-enter-1 relative z-50 mb-8">
        <h1 className="break-words text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
          {license.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
          {license.spdx_id && (
            <span className="font-mono">SPDX ID: {license.spdx_id}</span>
          )}
          {license.created_at && (
            <span>{t("detail.added", { date: license.created_at })}</span>
          )}
        </div>

        {/* Badges — Terms entries (type=terms) only show type badge */}
        <div className="mt-4 flex flex-wrap gap-2">
          {license.type === "terms" ? (
            <Badge variant="type" themeKey="terms">{t("type.terms")}</Badge>
          ) : (
            <>
              <Badge variant="type" themeKey={license.type}>{t(`type.${license.type}`)}</Badge>
              {license.osi_approved && <Badge variant="osi">{t("badge.osiApproved")}</Badge>}
              {license.fsf_libre && <Badge variant="fsf">{t("badge.fsfLibre")}</Badge>}
              {(license.fsf_tags || []).filter((ft) => ft !== "libre" && ft !== "non-free").map((tag) => {
                const tagKey = `tag.${tag}`;
                const translated = t(tagKey) !== tagKey ? t(tagKey) : tag.replace(/gpl|fdl/g, (m) => m.toUpperCase());
                return <Badge key={tag} variant="fsf-tag" themeKey={tag}>{translated}</Badge>;
              })}
              {formatLanguages(license.languages || [], lang).map((l) => (
                <Badge key={l} variant="language">{l}</Badge>
              ))}
              {license.tags.map((tag) => {
                const tagKey = `tag.${tag.toLowerCase().replace(/ /g, "-").replace(/[^a-z0-9-]/g, "")}`;
                const translated = t(tagKey) !== tagKey ? t(tagKey) : tag;
                return (
                  <Badge
                    key={tag}
                    variant={tag === "tl;drLegal Verified" ? "verified" : "tag"}
                    themeKey={tag}
                  >
                    {translated}
                  </Badge>
                );
              })}
              {reviewTracked && <Badge variant="tag" themeKey="review-tracked">{t("tag.review-tracked")}</Badge>}
            </>
          )}
        </div>
      </div>

      {/* Permissions / Conditions / Limitations */}
      {(license.permissions.length > 0 ||
        license.conditions.length > 0 ||
        license.limitations.length > 0) && (
        <div className="detail-enter-2 relative z-40 mb-8 flex flex-wrap gap-6">
          {license.permissions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                {t("detail.permissions")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {license.permissions.map((p) => {
                  const pKey = `perm.${p}`;
                  return <Badge key={p} variant="permission">{t(pKey) !== pKey ? t(pKey) : p}</Badge>;
                })}
              </div>
            </div>
          )}
          {license.conditions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                {t("detail.conditions")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {license.conditions.map((c) => {
                  const cKey = `cond.${c}`;
                  return <Badge key={c} variant="condition">{t(cKey) !== cKey ? t(cKey) : c}</Badge>;
                })}
              </div>
            </div>
          )}
          {license.limitations.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                {t("detail.limitations")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {license.limitations.map((l) => {
                  const lKey = `limit.${l}`;
                  return <Badge key={l} variant="limitation">{t(lKey) !== lKey ? t(lKey) : l}</Badge>;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Blue Oak Rating */}
      {license.blueoak_tier && (
        <div className="detail-enter-2 relative z-30 mb-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
            {t("detail.blueOakRating")}
          </p>
          <div className="flex items-center gap-3">
            <Badge variant="blue-oak" themeKey={license.blueoak_tier}>{t(`bo.${license.blueoak_tier.toLowerCase()}`) !== `bo.${license.blueoak_tier.toLowerCase()}` ? t(`bo.${license.blueoak_tier.toLowerCase()}`) : license.blueoak_tier}</Badge>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {t(`detail.blueOak.${license.blueoak_tier.toLowerCase()}`)}
            </span>
          </div>
        </div>
      )}

      {/* OSI License Review (only for licenses reviewed by OSI) */}
      <LicenseReviewBlock license={license} />

      {/* OSADL Open Source License Checklist */}
      <OsadlChecklistBlock entry={osadlEntry} meta={osadlMeta} />

      {/* License Text */}
      {license.body && (
        <div className="detail-enter-3">
          <LicenseBodySection slug={license.slug} body={license.body} hasBodies={!!license.languages && license.languages.length > 1} />
        </div>
      )}

      {/* Sources */}
      {license.sources.length > 0 && (
        <div className="detail-enter-4 mb-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            {t("detail.sources")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {license.sources.map((s, i) => (
              <a
                key={`${s.name}-${i}`}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  s.merged
                    ? "rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-violet-300 hover:text-[#7c3aed] dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-500 dark:hover:border-violet-700 dark:hover:text-[#a78bfa]"
                    : "rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-violet-300 hover:text-[#7c3aed] dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-violet-700 dark:hover:text-[#a78bfa]"
                }
              >
                {s.name} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Terms */}
      {license.terms && license.terms.length > 0 && (
        <div className="detail-enter-4 mb-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            {t("detail.terms")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {license.terms.map((term, i) => (
              term.slug ? (
                <Link
                  key={`${term.name}-${i}`}
                  href={`/licenses/${term.slug}`}
                  className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-violet-300 hover:text-[#7c3aed] dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-violet-700 dark:hover:text-[#a78bfa]"
                >
                  {term.name}
                </Link>
              ) : (
                <a
                  key={`${term.name}-${i}`}
                  href={term.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-violet-300 hover:text-[#7c3aed] dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-violet-700 dark:hover:text-[#a78bfa]"
                >
                  {term.name} ↗
                </a>
              )
            ))}
          </div>
        </div>
      )}

      {/* Report Issue */}
      <div className="detail-enter-4 mb-8 flex justify-end">
        <a
          href={`https://github.com/morningD/license.atlas/issues/new?template=license-feedback.yml&labels=license-feedback&title=${encodeURIComponent(`[Feedback] ${license.title}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:border-violet-300 hover:text-[#7c3aed] dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:border-violet-700 dark:hover:text-[#a78bfa]"
        >
          <span className="text-[1.5em] leading-none">🙌</span>
          {t("detail.reportIssue")}
        </a>
      </div>

      {/* Prev/Next */}
      <div className="detail-enter-4 flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
        {prev ? (
          <Link
            href={`/licenses/${prev.slug}`}
            className="max-w-[45%] truncate text-sm text-zinc-500 hover:text-[#7c3aed] dark:hover:text-[#a78bfa]"
          >
            &larr; {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/licenses/${next.slug}`}
            className="max-w-[45%] truncate text-right text-sm text-zinc-500 hover:text-[#7c3aed] dark:hover:text-[#a78bfa]"
          >
            {next.title} &rarr;
          </Link>
        ) : (
          <span />
        )}
      </div>
        </div>
        {hasShowcase && (
          <div className="mt-8 lg:mt-[7.875rem]">
            <ProjectShowcaseBlock entry={showcaseEntry} />
          </div>
        )}
      </div>
    </div>
  );
}
