// SPDX-License-Identifier: MulanPSL-2.0

"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";

const LANG_NAMES: Record<string, string> = {
  en: "English",
  "zh-hans": "简体中文",
  "zh-hant": "繁體中文",
  ja: "日本語",
  ko: "한국어",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  pt: "Português",
  ru: "Русский",
  ar: "العربية",
  nl: "Nederlands",
  pl: "Polski",
  tr: "Türkçe",
  sv: "Svenska",
  no: "Norsk",
  da: "Dansk",
  fi: "Suomi",
  cs: "Čeština",
  el: "Ελληνικά",
  he: "עברית",
  hr: "Hrvatski",
  hu: "Magyar",
  id: "Bahasa Indonesia",
  lt: "Lietuvių",
  lv: "Latviešu",
  ro: "Română",
  sk: "Slovenčina",
  sl: "Slovenščina",
  uk: "Українська",
  et: "Eesti",
  eu: "Euskara",
  fy: "Frysk",
  mi: "Te Reo Māori",
  ca: "Català",
  bg: "Български",
  th: "ไทย",
  vi: "Tiếng Việt",
  zh: "中文",
};

interface CcLangNavProps {
  bodies: { lang: string; body: string }[];
  onSelect: (body: string) => void;
}

export function CcLangNav({ bodies, onSelect }: CcLangNavProps) {
  const { t } = useLang();
  const langs = bodies.map((b) => b.lang);
  const [active, setActive] = useState("en");

  if (langs.length <= 1) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-zinc-400">{t("body.language")}:</span>
      {langs.map((lang) => (
        <button
          key={lang}
          onClick={() => {
            setActive(lang);
            const entry = bodies.find((b) => b.lang === lang);
            if (entry) onSelect(entry.body);
          }}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
            active === lang
              ? "bg-[#7c3aed]/15 text-[#7c3aed] font-semibold dark:bg-[#7c3aed]/20 dark:text-[#a78bfa]"
              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          {LANG_NAMES[lang] || lang}
        </button>
      ))}
    </div>
  );
}
