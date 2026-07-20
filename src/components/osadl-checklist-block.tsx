"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import licenses from "@/data/licenses-index.json";
import { useLang, type Lang } from "@/lib/i18n";
import type { License, OsadlChecklistAction, OsadlChecklistEntry, OsadlIndexMeta } from "@/lib/types";

type CompatibilityVerdict = "Yes" | "No" | "Same" | "Unknown" | "Check dependency";
type CompatibilityPosition = { x: number; y: number; listMaxHeight: number };

interface CompatibilityRow {
  target_spdx_id: string;
  verdict: CompatibilityVerdict;
  explanation: string;
}

interface CompatibilityRecord {
  spdx_id: string;
  compatibility?: CompatibilityRow[];
}

type ChecklistTone = "must" | "must-not";
type OsadlTermMap = Record<string, string>;

interface ChecklistDisplayAction {
  text: string;
  tone: ChecklistTone;
  condition: string;
  useCases: string[];
}

const licenseBySpdx = new Map(
  (licenses as Pick<License, "spdx_id" | "slug" | "title" | "version">[])
    .filter((license) => license.spdx_id)
    .map((license) => [normSpdx(license.spdx_id), license]),
);

function normSpdx(value: string | undefined) {
  return (value || "").trim().toLowerCase();
}

function osadlDataUrl() {
  if (typeof window === "undefined") return "/data/osadl-checklists.json";
  const basePath = window.location.pathname.startsWith("/license.atlas") ? "/license.atlas" : "";
  return `${basePath}/data/osadl-checklists.json`;
}

function compactSearch(value: string | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function titleInitials(value: string | undefined) {
  return (value || "")
    .replace(/\([^)]*\)/g, " ")
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word && !/^(the|a|an|and|or|of|for|to|version|license)$/i.test(word))
    .map((word) => word[0])
    .join("")
    .toLowerCase();
}

function licenseMatchesQuery(row: CompatibilityRow, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const compact = compactSearch(q);
  const license = licenseBySpdx.get(normSpdx(row.target_spdx_id));
  const values = [
    row.target_spdx_id,
    license?.spdx_id,
    license?.slug,
    license?.title,
    license?.version,
    titleInitials(license?.title),
  ].filter(Boolean) as string[];
  return values.some((value) => {
    const raw = value.toLowerCase();
    return raw.includes(q) || compactSearch(raw).includes(compact);
  });
}

function yesNoTone(value: string | null | undefined) {
  const normalized = (value || "").toLowerCase();
  if (normalized.startsWith("yes")) return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300";
  if (normalized.startsWith("no")) return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300";
  return "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300";
}

function sourceDisclosureTone(value: string | null | undefined) {
  const normalized = (value || "").toLowerCase();
  if (normalized.startsWith("yes")) return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300";
  if (normalized.startsWith("no")) return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300";
  return "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300";
}

function patentHintsTone(value: string | null | undefined) {
  const normalized = (value || "").toLowerCase();
  if (normalized.startsWith("yes")) return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300";
  if (normalized.startsWith("no")) return "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300";
  return "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300";
}

function formatTimestamp(value: string | undefined) {
  if (!value) return "";
  const isoish = value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const date = new Date(isoish);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

const CONDITION_ZH: OsadlTermMap = {
  "1": "条件 1",
  "2": "条件 2",
  "ATTRIBUTE Dynamic": "动态署名",
  "Advertisement": "广告",
  "Binary delivery": "二进制分发",
  "Combined work With AGPL-3.0-only": "与 AGPL-3.0-only 组合的作品",
  "Combined work With AGPL-3.0-only OR AGPL-3.0-or-later": "与 AGPL-3.0-only 或 AGPL-3.0-or-later 组合的作品",
  "Commercial distribution": "商业分发",
  "Displaying Copyright notices": "展示版权声明",
  "Distributed With Other works": "与其他作品一同分发",
  "Documentation": "文档",
  "Font Modification": "字体修改",
  "Including Windows code": "包含 Windows 代码",
  "Installation Is NOT Feasible": "无法安装",
  "Interactive": "交互式使用",
  "Interactive AND Displaying Appropriate legal notices": "交互式使用并展示适当法律声明",
  "Interactive AND Displaying Copyright notices": "交互式使用并展示版权声明",
  "Interactive AND Displaying License announcement": "交互式使用并展示许可证公告",
  "Interactive AND Reference Legal notices": "交互式使用并引用法律声明",
  "License change": "许可证变更",
  "Modification": "修改",
  "Modification Of Files": "修改文件",
  "Modified library NOT Interoperable": "修改后的库不可互操作",
  "Modified work Is Protocol incompatible": "修改后的作品协议不兼容",
  "Modified work Under Original license": "修改后的作品沿用原许可证",
  "NOT Binary delivery of standard UnZipSFX binary as part of a self-extracting archive AND NOT Delete SFX banner AND NOT Disable SFX banner": "非将标准 UnZipSFX 二进制作为自解压归档的一部分分发，且未删除或禁用 SFX 横幅",
  "NOT Legal notices": "非法律声明",
  "No Legal notices": "无法律声明",
  "Non-permissive additional terms Added": "添加非宽松附加条款",
  "Notice From Copyright holder": "版权持有人提供的通知",
  "Patent holder OR Trademark holder OR Third-party patents OR Third-party trademarks": "专利持有人、商标持有人、第三方专利或第三方商标",
  "Permitted Non-permissive additional terms": "允许的非宽松附加条款",
  "Pointer Expires": "指针过期",
  "Pointer To Copyright notices OR License": "指向版权声明或许可证",
  "Provided By Copyright holder": "由版权持有人提供",
  "Service offerings": "服务提供",
  "Software modification": "软件修改",
  "Software modification Of Library": "库的软件修改",
  "Software modification Uses Linked work": "软件修改使用链接作品",
  "Source code delivery": "源码分发",
  "Source code modification": "源码修改",
  "Substantial work": "实质性作品",
  "Third-party attribution notice In Copyright notices OR Terms of service OR By Reasonable means": "版权声明、服务条款或合理方式中的第三方署名声明",
  "Title": "标题",
  "Use in Product": "在产品中使用",
  "Work Includes File \"NOTICE\"": "作品包含 NOTICE 文件",
};

const USE_CASE_ZH: OsadlTermMap = {
  "Binary delivery": "二进制分发",
  "Binary delivery Of Combined work": "组合作品的二进制分发",
  "Binary delivery Of Linked work": "链接作品的二进制分发",
  "Binary delivery Of Linked work With Header files Of Library Included In Linked work": "链接作品的二进制分发（链接作品包含库头文件）",
  "Combined work delivery": "组合作品分发",
  "Font delivery": "字体分发",
  "Image delivery OR Font delivery": "图像或字体分发",
  "Network service": "网络服务",
  "Network services": "网络服务",
  "Source code delivery": "源码分发",
  "Source code delivery OR Binary delivery": "源码或二进制分发",
  "Source code delivery OR Binary delivery OR Network service": "源码分发、二进制分发或网络服务",
  "Source code delivery Of Combined library OR Binary delivery Of Combined library": "组合库的源码或二进制分发",
  "Source code delivery Of Combined work": "组合作品的源码分发",
  "Work Delivery": "作品分发",
};

const TERM_ZH: OsadlTermMap = {
  "AGPL-3.0-only OR AGPL-3.0-or-later": "AGPL-3.0-only 或 AGPL-3.0-or-later",
  "AGPL-3.0-only": "AGPL-3.0-only",
  "Appropriate legal notices": "适当法律声明",
  "Attribution notice": "署名声明",
  "Attribution notices": "署名声明",
  "Binary delivery": "二进制分发",
  "Combined library": "组合库",
  "Combined work": "组合作品",
  "Compatible license": "兼容许可证",
  "Contributors": "贡献者",
  "Copyright holder": "版权持有人",
  "Copyright notice": "版权声明",
  "Copyright notices": "版权声明",
  "Delayed source code delivery": "延迟源码提供",
  "Distribution material": "分发材料",
  "Advertisement": "广告",
  "Documentation": "文档",
  "Equivalent License obligations": "等同的许可证义务",
  "File 「LEGAL」": "LEGAL 文件",
  "File 「NOTICE」 In Documentation": "文档中的 NOTICE 文件",
  "File 「NOTICE」 In Source code": "源码中的 NOTICE 文件",
  "File 「NOTICE」": "NOTICE 文件",
  "Font Name": "字体名称",
  "Granted rights": "已授予权利",
  "Header files": "头文件",
  "Installation information": "安装信息",
  "Interface To Work": "作品接口",
  "Irrelevant parts": "无关部分",
  "Legal notices": "法律声明",
  "Liability disclaimer": "责任免责声明",
  "Liability disclaimers": "责任免责声明",
  "Library": "库",
  "License acceptance": "许可证接受",
  "License announcement": "许可证公告",
  "License fee": "许可证费用",
  "License notice": "许可证声明",
  "License notices": "许可证声明",
  "License obligations": "许可证义务",
  "License text": "许可证文本",
  "Modification author": "修改作者",
  "Modification date": "修改日期",
  "Modification notice": "修改声明",
  "Modification reason": "修改理由",
  "Modification report": "修改报告",
  "Modified library": "修改后的库",
  "Modified work": "修改后的作品",
  "Name": "名称",
  "Non-permissive additional terms": "非宽松附加条款",
  "Notice": "通知",
  "Original authors": "原作者",
  "Original license": "原许可证",
  "Original name": "原名称",
  "Original source code": "原始源码",
  "Original work": "原作品",
  "Other Contributors": "其他贡献者",
  "Other contributors": "其他贡献者",
  "Patent notice": "专利声明",
  "Patent notices": "专利声明",
  "Pointer On Request": "按请求提供指针",
  "Pointer To Source code": "源码指针",
  "Pointer To Warranty disclaimer": "免责声明指针",
  "Pointer": "指针",
  "Primary reserved font name": "主要保留字体名称",
  "Product name": "产品名称",
  "Reference To Warranty disclaimer": "免责声明引用",
  "Relinking With Modified library": "与修改后的库重新链接",
  "Retrieval information of Source code in Notice": "通知中的源码获取信息",
  "Retrieval information": "获取信息",
  "Reverse engineering of Linked work": "对链接作品的逆向工程",
  "Reverse engineering": "逆向工程",
  "Source code delivery": "源码分发",
  "Source code": "源码",
  "Standard license notice": "标准许可证声明",
  "Strong copyleft license": "强 copyleft 许可证",
  "Target binary": "目标二进制文件",
  "Technological measures": "技术措施",
  "Third-party attribution notice": "第三方署名声明",
  "Title Of Work": "作品标题",
  "Trademark notice": "商标声明",
  "Trademark notices": "商标声明",
  "Warranty disclaimer of Apple": "Apple 免责声明",
  "Warranty disclaimer": "免责声明",
  "Warranty disclaimers": "免责声明",
  "Written offer": "书面要约",
};

const PLACE_ZH: OsadlTermMap = {
  "Advertisement": "广告",
  "Binary delivery": "二进制分发",
  "Distribution material": "分发材料",
  "Documentation": "文档",
  "Source code delivery": "源码分发",
};

const ACTION_EXACT_ZH: OsadlTermMap = {
  "Append Name To Original name": "在原名称后追加名称",
  "End Binary delivery": "停止二进制分发",
  "Grant License": "授予许可证",
  "Indemnify Original authors": "使原作者免受相关责任或索赔，并承担赔偿义务",
  "Indemnify Other Contributors": "使其他贡献者免受相关责任或索赔，并承担赔偿义务",
  "Indemnify Other contributors": "使其他贡献者免受相关责任或索赔，并承担赔偿义务",
  "Inform Recipients": "通知接收方",
  "Permit Binary delivery of Library": "允许库的二进制分发",
  "Permit Modification of Linked work": "允许修改链接作品",
  "Permit Reverse engineering of Linked work": "允许对链接作品进行逆向工程",
  "Prepend \"PHP\" To Product name": "在产品名称前加上「PHP」",
  "Promote": "用于宣传或背书",
  "Search License acceptance": "检查许可证接受情况",
  "Sell Font": "销售字体",
  "Sublicense": "再许可",
  "Use": "使用",
};

const ACTION_VERBS_ZH: OsadlTermMap = {
  "Append": "追加",
  "Credit": "署名标注",
  "Delete": "删除",
  "Disseminate": "传播",
  "Display": "展示",
  "Enable": "允许",
  "Ensure": "确保",
  "Forward": "随同传递",
  "Fulfill": "履行",
  "Impede": "阻碍",
  "Include": "包含",
  "Indemnify": "赔偿",
  "Litigate": "就以下事项提起诉讼：",
  "Mark": "标记",
  "Misrepresent": "歪曲",
  "Modify": "修改",
  "Notify": "通知",
  "Permit": "允许",
  "Prepend": "前置",
  "Promote Using": "使用以下名称宣传：",
  "Provide": "提供",
  "Publish": "发布",
  "Reference": "引用",
  "Rename": "重命名",
  "Require": "要求",
  "Restrict": "限制",
  "Update": "更新",
  "Use": "使用",
};

function protectQuotedText(value: string) {
  const parts: string[] = [];
  const text = value.replace(/"([^"]*)"/g, (_, quoted: string) => {
    const token = `__Q${parts.length}__`;
    parts.push(`「${quoted.replace(/&lt;/g, "<").replace(/&gt;/g, ">")}」`);
    return token;
  });
  return { text, parts };
}

function restoreQuotedText(value: string, parts: string[]) {
  return parts.reduce((text, part, idx) => text.replace(`__Q${idx}__`, part), value);
}

function translatePlaceList(value: string) {
  return value
    .split(/\s+AND\s+|\s+OR\s+/)
    .map((part) => PLACE_ZH[part.trim()] || translateTerm(part.trim()))
    .join(value.includes(" OR ") ? "或" : "、");
}

function translateQuotedList(value: string) {
  const quoted = [...value.matchAll(/"([^"]+)"/g)].map((match) => `「${match[1]}」`);
  if (!quoted.length) return value;
  return quoted.join(value.toLowerCase().includes(" or ") || value.includes(" OR ") ? "或" : "、");
}

function translateCreditAction(value: string) {
  let m = value.match(/^Credit In (.+?) Verbatim "([^"]+)"$/);
  if (m) return `在${translatePlaceList(m[1])}中逐字标注「${m[2]}」`;

  m = value.match(/^Credit Verbatim In (.+?) "([^"]+)"$/);
  if (m) return `在${translatePlaceList(m[1])}中逐字标注「${m[2]}」`;

  m = value.match(/^Credit Verbatim "([^"]+)" In (.+)$/);
  if (m) return `在${translatePlaceList(m[2])}中逐字标注「${m[1]}」`;

  m = value.match(/^Credit Verbatim "([^"]+)"$/);
  if (m) return `逐字标注「${m[1]}」`;

  m = value.match(/^Credit In (.+?) (.+)$/);
  if (m) return `在${translatePlaceList(m[1])}中标注 ${m[2]}`;

  return value.replace(/^Credit\s+/, "标注 ");
}

function translatePromoteAction(value: string) {
  if (value === "Promote") return "用于宣传或背书";
  const m = value.match(/^Promote Using (.+)$/);
  if (m) return `使用${translateQuotedList(m[1])}进行宣传或背书`;
  return value;
}

function translateUseAction(value: string) {
  let m = value.match(/^Use (.+?) In Product name$/);
  if (m) return `在产品名称中使用${translateQuotedList(m[1])}`;

  m = value.match(/^Use (.+?) In Font Name$/);
  if (m) return `在字体名称中使用${translateQuotedList(m[1])}`;

  m = value.match(/^Use (.+?) In Name$/);
  if (m) return `在名称中使用${translateQuotedList(m[1])}`;

  m = value.match(/^Use "([^"]+)"(?:, .*)?$/);
  if (m && value.includes(",")) return `使用这些名称：${translateQuotedList(value)}`;

  return "";
}

function translateTerm(value: string): string {
  const raw = value.trim();
  if (!raw) return raw;
  if (TERM_ZH[raw]) return TERM_ZH[raw];
  if (USE_CASE_ZH[raw]) return USE_CASE_ZH[raw];
  if (CONDITION_ZH[raw]) return CONDITION_ZH[raw];

  for (const op of [" AND ", " OR "]) {
    if (raw.includes(op)) {
      const joiner = op.trim() === "AND" ? "和" : "或";
      return raw.split(op).map(translateTerm).join(joiner);
    }
  }
  if (raw.startsWith("NOT ")) return `非${translateTerm(raw.slice(4))}`;

  const prepPatterns: [RegExp, (left: string, right: string) => string][] = [
    [/^(.+?) In (.+)$/, (left, right) => `在${translateTerm(right)}中${translateTerm(left)}`],
    [/^(.+?) On behalf of (.+)$/, (left, right) => `代表${translateTerm(right)}使用${translateTerm(left)}`],
    [/^(.+?) Of (.+)$/, (left, right) => `${translateTerm(right)}的${translateTerm(left)}`],
    [/^(.+?) For (.+)$/, (left, right) => `用于${translateTerm(right)}的${translateTerm(left)}`],
    [/^(.+?) With (.+)$/, (left, right) => `${translateTerm(left)}（包含${translateTerm(right)}）`],
    [/^(.+?) Under (.+)$/, (left, right) => `${translateTerm(left)}（遵循${translateTerm(right)}）`],
    [/^(.+?) As (.+)$/, (left, right) => `以${translateTerm(right)}形式${translateTerm(left)}`],
    [/^(.+?) To (.+)$/, (left, right) => `向${translateTerm(right)}${translateTerm(left)}`],
  ];
  for (const [pattern, render] of prepPatterns) {
    const match = raw.match(pattern);
    if (match) return render(match[1], match[2]);
  }

  return raw
    .replace(/\bAND\b/g, "和")
    .replace(/\bOR\b/g, "或")
    .replace(/\bNOT\b/g, "非")
    .replace(/\bOf\b/g, "的")
    .replace(/\bIn\b/g, "在")
    .replace(/\bWith\b/g, "包含")
    .replace(/\bFor\b/g, "用于")
    .replace(/\bTo\b/g, "向");
}

function translateOsadlText(value: string, lang: Lang, kind: "action" | "condition" | "use-case", context?: { condition?: string }) {
  if (lang !== "zh") return value;
  if (kind === "condition") return CONDITION_ZH[value] || translateTerm(value);
  if (kind === "use-case") return USE_CASE_ZH[value] || translateTerm(value);

  if (/^Indemnify Other Contributors?$/i.test(value)) {
    if (context?.condition === "Service offerings") {
      return "因自行提供支持、担保、赔偿或其他额外责任，使其他贡献者免受相关责任或索赔";
    }
    if (context?.condition === "Commercial distribution") {
      return "因商业分发引发的责任或索赔，使其他贡献者免受影响并承担赔偿义务";
    }
    if (context?.condition === "License change") {
      return "因改用或追加许可证条款产生的责任或索赔，使其他贡献者免受影响并承担赔偿义务";
    }
  }
  if (value.startsWith("Credit ")) return translateCreditAction(value);
  if (value.startsWith("Promote")) return translatePromoteAction(value);
  const useText = translateUseAction(value);
  if (useText) return useText;

  if (ACTION_EXACT_ZH[value]) return ACTION_EXACT_ZH[value];
  const { text, parts } = protectQuotedText(value);
  if (ACTION_EXACT_ZH[text]) return restoreQuotedText(ACTION_EXACT_ZH[text], parts);

  const verb = Object.keys(ACTION_VERBS_ZH)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => text === candidate || text.startsWith(`${candidate} `));
  if (!verb) return restoreQuotedText(translateTerm(text), parts);
  const rest = text.slice(verb.length).trim();
  const translated = rest ? `${ACTION_VERBS_ZH[verb]}${translateTerm(rest)}` : ACTION_VERBS_ZH[verb];
  return restoreQuotedText(translated, parts);
}

function translateOsadlValue(value: string | number | null | undefined, lang: Lang) {
  if (lang !== "zh" || typeof value !== "string") return value;
  const normalized = value.toLowerCase();
  if (normalized.startsWith("yes")) return value.replace(/^yes/i, "是");
  if (normalized.startsWith("no")) return value.replace(/^no/i, "否");
  if (normalized === "unknown") return "未知";
  return value;
}

function InlineStat({ label, value, className, tooltip }: {
  label: string;
  value: string | number | null | undefined;
  className?: string;
  tooltip?: string;
}) {
  return (
    <span className="group/stat relative inline-flex">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${className || "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300"}`}
        aria-label={tooltip ? `${label}: ${value || "Unknown"}. ${tooltip}` : undefined}
      >
        <span className="font-medium opacity-70">{label}</span>
        <span className="font-semibold">{value || "Unknown"}</span>
      </span>
      {tooltip && (
        <span className="pointer-events-none absolute left-1/2 top-full z-[120] mt-1.5 hidden w-64 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-[11px] leading-snug text-zinc-700 shadow-lg group-hover/stat:block group-focus-within/stat:block dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          {tooltip}
        </span>
      )}
    </span>
  );
}

function mergeChecklistActions(
  obligations: OsadlChecklistAction[],
  prohibitions: OsadlChecklistAction[],
  defaultCondition: string,
) {
  const merged = new Map<string, ChecklistDisplayAction>();

  function add(action: OsadlChecklistAction, tone: ChecklistTone) {
    const condition = action.condition || defaultCondition;
    const key = `${tone}\u0000${condition}\u0000${action.text}`;
    const existing = merged.get(key);
    if (existing) {
      if (action.use_case && !existing.useCases.includes(action.use_case)) {
        existing.useCases.push(action.use_case);
      }
      return;
    }
    merged.set(key, {
      text: action.text,
      tone,
      condition,
      useCases: action.use_case ? [action.use_case] : [],
    });
  }

  obligations.forEach((action) => add(action, "must"));
  prohibitions.forEach((action) => add(action, "must-not"));
  return Array.from(merged.values());
}

function splitUseCaseParts(useCase: string) {
  return useCase
    .split(/\s+(?:OR|AND)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function actionMatchesUseCase(action: ChecklistDisplayAction, activeUseCase: string) {
  if (activeUseCase === "all") return true;
  return action.useCases.some((useCase) => {
    if (useCase === activeUseCase) return true;
    return splitUseCaseParts(useCase).includes(activeUseCase);
  });
}

function ChecklistActionTree({ entry, lang, labels }: {
  entry: OsadlChecklistEntry;
  lang: Lang;
  labels: {
    must: string;
    mustNot: string;
    required: string;
    prohibited: string;
    actionsTitle: string;
    defaultCondition: string;
    noActions: string;
    noProhibitionsCompact: string;
    more: (remaining: number) => string;
  };
}) {
  const [activeUseCase, setActiveUseCase] = useState("all");
  const actions = mergeChecklistActions(entry.obligations, entry.prohibitions, labels.defaultCondition);
  const groups = new Map<string, ChecklistDisplayAction[]>();
  actions.forEach((action) => {
    const list = groups.get(action.condition) || [];
    list.push(action);
    groups.set(action.condition, list);
  });
  const groupEntries = Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === labels.defaultCondition) return -1;
    if (b === labels.defaultCondition) return 1;
    return a.localeCompare(b);
  });
  const displayedMustCount = actions.filter((action) => action.tone === "must").length;
  const displayedMustNotCount = actions.length - displayedMustCount;

  if (!actions.length) {
    return (
      <div className="rounded-xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800/70 dark:bg-zinc-950/30">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{labels.actionsTitle}</h3>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">0</span>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{labels.noActions}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800/70 dark:bg-zinc-950/30">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{labels.actionsTitle}</h3>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
            {labels.required}: {displayedMustCount}
          </span>
          {displayedMustNotCount > 0 ? (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {labels.prohibited}: {displayedMustNotCount}
            </span>
          ) : (
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              {labels.noProhibitionsCompact}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 font-mono text-[12px] leading-5 text-zinc-700 dark:text-zinc-300">
        {groupEntries.map(([condition, group]) => {
          const visible = group.slice(0, 8);
          const remaining = group.length - visible.length;
          const mustCount = group.filter((action) => action.tone === "must").length;
          const mustNotCount = group.length - mustCount;
          return (
            <div key={condition}>
              <div className="mb-1 grid grid-cols-[4ch_minmax(0,1fr)] text-zinc-900 dark:text-zinc-100">
                <span>+--</span>
                <span>
                  <span className="font-semibold">{translateOsadlText(condition, lang, "condition")}</span>
                <span className="font-sans text-[11px] text-zinc-500 dark:text-zinc-400">
                  {" "}
                  ({[
                    mustCount > 0 ? `${labels.must}: ${mustCount}` : "",
                    mustNotCount > 0 ? `${labels.mustNot}: ${mustNotCount}` : "",
                  ].filter(Boolean).join(", ")})
                </span>
                </span>
              </div>
              <ul className="space-y-0.5">
                {visible.map((action, idx) => {
                  const isDimmed = activeUseCase !== "all" && !actionMatchesUseCase(action, activeUseCase);
                  return (
                    <li
                      key={`${condition}-${action.tone}-${action.text}-${idx}`}
                      className={`grid grid-cols-[4ch_11ch_minmax(0,1fr)] gap-x-1 transition-opacity ${isDimmed ? "opacity-30" : ""}`}
                    >
                      <span className={action.tone === "must" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                        | -
                      </span>
                      <span className={action.tone === "must" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                        [{action.tone === "must" ? labels.must : labels.mustNot}]
                      </span>{" "}
                      <span className="font-sans">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{translateOsadlText(action.text, lang, "action", { condition: action.condition })}</span>
                        {action.useCases.length > 0 && (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {" "}
                            (
                            {action.useCases.map((useCase, useCaseIdx) => {
                              const selected = activeUseCase !== "all" && actionMatchesUseCase({ ...action, useCases: [useCase] }, activeUseCase);
                              return (
                                <span key={useCase}>
                                  {useCaseIdx > 0 && " / "}
                                  <button
                                    type="button"
                                    onClick={() => setActiveUseCase(selected ? "all" : useCase)}
                                    className={`cursor-pointer rounded px-1 py-0.5 transition-colors ${
                                      selected
                                        ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200"
                                        : "hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                                    }`}
                                  >
                                    {translateOsadlText(useCase, lang, "use-case")}
                                  </button>
                                </span>
                              );
                            })}
                            )
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {remaining > 0 && (
                <p className="mt-1 grid grid-cols-[4ch_minmax(0,1fr)] text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <span>|</span>
                  <span className="font-sans">{labels.more(remaining)}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompatibilityBar({ entry, onSelect, t }: {
  entry: OsadlChecklistEntry;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelect: (verdict: CompatibilityVerdict, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const s = entry.compatibility_summary;
  const total = s.yes + s.no + s.same + s.unknown + s.check_dependency;
  if (!total) return null;
  const parts = [
    { key: "yes", verdict: "Yes" as const, value: s.yes, label: t("osadl.verdict.yes"), barClass: "bg-emerald-500 hover:bg-emerald-600", swatchClass: "bg-emerald-500" },
    { key: "same", verdict: "Same" as const, value: s.same, label: t("osadl.verdict.same"), barClass: "bg-sky-500 hover:bg-sky-600", swatchClass: "bg-sky-500" },
    { key: "check", verdict: "Check dependency" as const, value: s.check_dependency, label: t("osadl.verdict.check"), barClass: "bg-amber-500 hover:bg-amber-600", swatchClass: "bg-amber-500" },
    { key: "no", verdict: "No" as const, value: s.no, label: t("osadl.verdict.no"), barClass: "bg-rose-500 hover:bg-rose-600", swatchClass: "bg-rose-500" },
    { key: "unknown", verdict: "Unknown" as const, value: s.unknown, label: t("osadl.verdict.unknown"), barClass: "bg-zinc-400 hover:bg-zinc-500", swatchClass: "bg-zinc-400" },
  ].filter((part) => part.value > 0);

  return (
    <div>
      <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        {parts.map((part) => (
          <button
            key={part.key}
            type="button"
            className={`${part.barClass} transition-colors`}
            style={{ width: `${(part.value / total) * 100}%` }}
            onClick={(event) => onSelect(part.verdict, event)}
            title={`${part.label}: ${part.value}`}
            aria-label={`${part.label}: ${part.value}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {parts.map((part) => (
          <button
            key={part.key}
            type="button"
            onClick={(event) => onSelect(part.verdict, event)}
            className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <span className={`h-2 w-2 rounded-full ${part.swatchClass}`} aria-hidden="true" />
            {part.label}: {part.value}
          </button>
        ))}
      </div>
    </div>
  );
}

function verdictLabel(t: (key: string) => string, verdict: CompatibilityVerdict) {
  const labels: Record<CompatibilityVerdict, string> = {
    Yes: "osadl.verdict.yes",
    No: "osadl.verdict.no",
    Same: "osadl.verdict.same",
    Unknown: "osadl.verdict.unknown",
    "Check dependency": "osadl.verdict.checkDependency",
  };
  return t(labels[verdict]);
}

function CompatibilityPopover({
  rows,
  verdict,
  position,
  query,
  loading,
  error,
  t,
  onQuery,
}: {
  rows: CompatibilityRow[];
  verdict: CompatibilityVerdict;
  position: CompatibilityPosition;
  query: string;
  loading: boolean;
  error: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onQuery: (value: string) => void;
}) {
  const q = query.trim().toLowerCase();
  const filtered = rows
    .filter((row) => row.verdict === verdict)
    .filter((row) => licenseMatchesQuery(row, q));
  const labels = {
    search: t("osadl.search"),
    loading: t("osadl.loading"),
    error: t("osadl.loadError"),
    empty: t("osadl.noLicenses"),
  };

  return (
    <div
      className="absolute z-50 w-72 max-w-[calc(100vw-1rem)] rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
      style={{ left: position.x, top: position.y }}
      role="dialog"
      aria-label={verdictLabel(t, verdict)}
    >
      <div className="border-b border-zinc-100 px-2 py-1.5 dark:border-zinc-800">
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={labels.search}
          className="h-7 w-full rounded border border-zinc-200 bg-white px-2 text-[11px] outline-none transition-colors placeholder:text-zinc-400 focus:border-cyan-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
      <div className="overflow-y-auto py-1.5 pr-5" style={{ maxHeight: position.listMaxHeight }}>
        {loading ? (
          <p className="px-2 py-1 text-[11px] text-zinc-500 dark:text-zinc-400">{labels.loading}</p>
        ) : error ? (
          <p className="px-2 py-1 text-[11px] text-rose-600 dark:text-rose-300">{labels.error}</p>
        ) : filtered.length ? (
          filtered.map((row) => {
            const license = licenseBySpdx.get(normSpdx(row.target_spdx_id));
            const name = license?.title || row.target_spdx_id;
            return license ? (
              <Link
                key={row.target_spdx_id}
                href={`/licenses/${license.slug}`}
                className="block truncate border-b border-zinc-100 px-2 py-1 text-[11px] leading-5 text-zinc-700 transition-colors last:border-b-0 hover:bg-cyan-50 hover:text-cyan-800 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-cyan-950/30 dark:hover:text-cyan-200"
              >
                {name} ↗
              </Link>
            ) : (
              <div key={row.target_spdx_id} className="truncate border-b border-zinc-100 px-2 py-1 text-[11px] leading-5 text-zinc-500 last:border-b-0 dark:border-zinc-800 dark:text-zinc-400">
                {name}
              </div>
            );
          })
        ) : (
          <p className="px-2 py-1 text-[11px] text-zinc-500 dark:text-zinc-400">{labels.empty}</p>
        )}
      </div>
    </div>
  );
}

export function OsadlChecklistBlock({ entry, meta }: {
  entry: OsadlChecklistEntry | null;
  meta: OsadlIndexMeta;
}) {
  const { lang, t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const [activeVerdict, setActiveVerdict] = useState<CompatibilityVerdict | null>(null);
  const [compatibilityRows, setCompatibilityRows] = useState<CompatibilityRow[]>([]);
  const [compatibilityLoading, setCompatibilityLoading] = useState(false);
  const [compatibilityError, setCompatibilityError] = useState("");
  const [compatibilityQuery, setCompatibilityQuery] = useState("");
  const [compatibilityPosition, setCompatibilityPosition] = useState<CompatibilityPosition>({ x: 16, y: 16, listMaxHeight: 260 });
  const compatibilityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeVerdict) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && compatibilityRef.current?.contains(target)) return;
      setActiveVerdict(null);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [activeVerdict]);

  if (!entry) return null;
  const currentEntry = entry;

  async function loadCompatibilityRows() {
    if (compatibilityRows.length || compatibilityLoading) return;
    setCompatibilityLoading(true);
    setCompatibilityError("");
    try {
      const response = await fetch(osadlDataUrl());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { records?: CompatibilityRecord[] };
      const record = (data.records || []).find((item) => normSpdx(item.spdx_id) === normSpdx(currentEntry.spdx_id));
      setCompatibilityRows(record?.compatibility || []);
    } catch (error) {
      setCompatibilityError(error instanceof Error ? error.message : "unknown error");
    } finally {
      setCompatibilityLoading(false);
    }
  }

  function openCompatibility(verdict: CompatibilityVerdict, event: MouseEvent<HTMLButtonElement>) {
    setCompatibilityQuery("");
    const width = 288;
    const margin = 8;
    const offset = 10;
    const rect = compatibilityRef.current?.getBoundingClientRect();
    const originLeft = rect?.left ?? 0;
    const originTop = rect?.top ?? 0;
    const maxLocalX = window.innerWidth - width - margin - originLeft;
    const x = Math.max(margin, Math.min(event.clientX - originLeft + offset, maxLocalX));
    const y = Math.max(margin, event.clientY - originTop + offset);
    const searchAndChromeHeight = 52;
    const availableListHeight = window.innerHeight - (event.clientY + offset) - margin - searchAndChromeHeight;
    setCompatibilityPosition({
      x,
      y,
      listMaxHeight: Math.max(72, Math.min(260, availableListHeight)),
    });
    setActiveVerdict((current) => current === verdict ? null : verdict);
    void loadCompatibilityRows();
  }

  const labels = {
    title: t("osadl.title"),
    must: t("osadl.must"),
    mustNot: t("osadl.mustNot"),
    required: t("osadl.required"),
    prohibited: t("osadl.prohibited"),
    actionsTitle: t("osadl.actionsTitle"),
    defaultCondition: t("osadl.defaultCondition"),
    compatibility: t("osadl.compatibility"),
    copyleft: t("osadl.copyleft"),
    sourceDisclosure: t("osadl.sourceDisclosure"),
    patent: t("osadl.patent"),
    raw: t("osadl.raw"),
    updated: t("osadl.updated"),
    source: t("osadl.source"),
    rawData: t("osadl.rawData"),
    project: t("osadl.project"),
    compatibilityLink: t("osadl.compatibilityLink"),
    copyleftHelp: t("osadl.copyleftHelp"),
    sourceDisclosureHelp: t("osadl.sourceDisclosureHelp"),
    patentHelp: t("osadl.patentHelp"),
    noActions: t("osadl.noActions"),
    noProhibitionsCompact: t("osadl.noProhibitionsCompact"),
    more: (count: number) => t("osadl.more", { count }),
  };
  function toggleExpanded() {
    setExpanded((current) => !current);
    setActiveVerdict(null);
  }

  function isInteractiveTarget(target: EventTarget | null) {
    return target instanceof Element && !!target.closest("a,button,input,textarea,select,[data-osadl-interactive='true']");
  }

  return (
    <section
      className="detail-enter-3 relative z-10 mb-8 cursor-pointer rounded-2xl border border-cyan-200/70 bg-cyan-50/40 p-4 transition-colors hover:border-cyan-300/80 hover:bg-cyan-50/70 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:border-cyan-900/40 dark:bg-cyan-950/10 dark:hover:border-cyan-800/70 dark:hover:bg-cyan-950/20 sm:p-5"
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={(event) => {
        if (isInteractiveTarget(event.target)) return;
        toggleExpanded();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (isInteractiveTarget(event.target)) return;
        event.preventDefault();
        toggleExpanded();
      }}
    >
      <div className={expanded ? "mb-4 flex flex-col gap-2" : "flex flex-col gap-2"}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {labels.title}
          </h2>
          <span className="font-mono text-xs text-cyan-700 dark:text-cyan-300" aria-hidden="true">
            {expanded ? "[-]" : "[+]"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <InlineStat label={labels.copyleft} value={translateOsadlValue(entry.copyleft, lang)} className={yesNoTone(entry.copyleft)} tooltip={labels.copyleftHelp} />
          <InlineStat label={labels.sourceDisclosure} value={translateOsadlValue(entry.source_disclosure, lang)} className={sourceDisclosureTone(entry.source_disclosure)} tooltip={labels.sourceDisclosureHelp} />
          <InlineStat label={labels.patent} value={translateOsadlValue(entry.patent_hints || "Unknown", lang)} className={patentHintsTone(entry.patent_hints)} tooltip={labels.patentHelp} />
          <InlineStat label={labels.updated} value={formatTimestamp(meta.timestamp)} />
        </div>
      </div>

      {expanded && (
        <div className="cursor-default" data-osadl-interactive="true">
          <div className="mb-5">
            <ChecklistActionTree entry={entry} lang={lang} labels={labels} />
          </div>

          <div className="mb-4 rounded-xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800/70 dark:bg-zinc-950/30">
            <h3 className="mb-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {labels.compatibility}
            </h3>
            <div
              ref={compatibilityRef}
              className="relative w-full"
            >
              <CompatibilityBar entry={entry} t={t} onSelect={openCompatibility} />
              {activeVerdict && (
                <CompatibilityPopover
                  rows={compatibilityRows}
                  verdict={activeVerdict}
                  position={compatibilityPosition}
                  query={compatibilityQuery}
                  loading={compatibilityLoading}
                  error={compatibilityError}
                  t={t}
                  onQuery={setCompatibilityQuery}
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              {labels.source}: {meta.source}{" "}
              <a href={entry.source_urls.txt || entry.source_urls.json || meta.source_url} target="_blank" rel="noopener noreferrer" className="font-medium text-cyan-700 hover:text-cyan-900 dark:text-cyan-300">
                {labels.raw} ↗
              </a>
            </span>
            <a href={meta.source_url} target="_blank" rel="noopener noreferrer" className="font-medium text-cyan-700 hover:text-cyan-900 dark:text-cyan-300">{labels.rawData}</a>
            <a href={meta.checklist_project_url} target="_blank" rel="noopener noreferrer" className="font-medium text-cyan-700 hover:text-cyan-900 dark:text-cyan-300">{labels.project}</a>
            <a href={meta.compatibility_notes_url} target="_blank" rel="noopener noreferrer" className="font-medium text-cyan-700 hover:text-cyan-900 dark:text-cyan-300">{labels.compatibilityLink}</a>
          </div>
        </div>
      )}
    </section>
  );
}
