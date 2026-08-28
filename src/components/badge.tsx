import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

type BadgeVariant = "osi" | "fsf" | "type" | "tag" | "permission" | "condition" | "limitation" | "verified" | "language" | "fsf-tag" | "blue-oak";

interface BadgeTheme {
  desc: string;
  badge: string;
  tooltip: string;
  glow: string;
}

// One place to define all badge themes. Key = normalized lowercase-hyphenated name.
// Adding a new tag/style = add one entry here.
export const themes: Record<string, BadgeTheme> = {
  // Types
  software: {
    desc: "Software license governing source code usage, modification, and distribution",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
    tooltip: "bg-violet-50 border-violet-300 dark:bg-violet-950 dark:border-violet-700",
    glow: "shadow-[0_0_8px_rgba(139,92,246,0.3)]",
  },
  model: {
    desc: "AI model license for machine learning weights and parameters",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    tooltip: "bg-sky-50 border-sky-300 dark:bg-sky-950 dark:border-sky-700",
    glow: "shadow-[0_0_8px_rgba(14,165,233,0.3)]",
  },
  data: {
    desc: "Data license governing dataset usage and redistribution",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    tooltip: "bg-orange-50 border-orange-300 dark:bg-orange-950 dark:border-orange-700",
    glow: "shadow-[0_0_8px_rgba(249,115,22,0.3)]",
  },
  agent: {
    desc: "License for AI agent tools — MCP servers, agent frameworks, skills, and LLM integrations",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    tooltip: "bg-purple-50 border-purple-300 dark:bg-purple-950 dark:border-purple-700",
    glow: "shadow-[0_0_8px_rgba(168,85,247,0.3)]",
  },
  terms: {
    desc: "Terms of Service referenced by a license — not a standalone license itself",
    badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    tooltip: "bg-teal-50 border-teal-300 dark:bg-teal-950 dark:border-teal-700",
    glow: "shadow-[0_0_8px_rgba(20,184,166,0.3)]",
  },
  // Review tracker marker + OSI Review Tracker statuses (review-* themeKey)
  "review-tracked": {
    desc: "Has a public license review record, including submissions, discussions, votes, or final decisions.",
    badge: "bg-[#3da639]/[0.08] text-[#2f7d32] ring-1 ring-inset ring-[#3da639]/20 dark:bg-[#3da639]/[0.12] dark:text-[#78d672] dark:ring-[#3da639]/25",
    tooltip: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
    glow: "shadow-[0_0_8px_rgba(61,166,57,0.18)]",
  },
  "review-approved": {
    desc: "OSI board approved this license.",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    tooltip: "bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-700",
    glow: "shadow-[0_0_8px_rgba(34,197,94,0.3)]",
  },
  "review-rejected": {
    desc: "OSI board rejected this license.",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    tooltip: "bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-700",
    glow: "shadow-[0_0_8px_rgba(239,68,68,0.3)]",
  },
  "review-pending": {
    desc: "Under review.",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    tooltip: "bg-violet-50 border-violet-300 dark:bg-violet-950 dark:border-violet-700",
    glow: "shadow-[0_0_8px_rgba(139,92,246,0.3)]",
  },
  "review-withdrawn": {
    desc: "Submitter withdrew this license.",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    tooltip: "bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-700",
    glow: "shadow-[0_0_8px_rgba(245,158,11,0.3)]",
  },
  "review-superseded": {
    desc: "Replaced by a later version.",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    tooltip: "bg-sky-50 border-sky-300 dark:bg-sky-950 dark:border-sky-700",
    glow: "shadow-[0_0_8px_rgba(14,165,233,0.3)]",
  },
  "review-legacy": {
    desc: "Pre-review-era license (board resolution, no public thread).",
    badge: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300",
    tooltip: "bg-zinc-50 border-zinc-300 dark:bg-zinc-800 dark:border-zinc-600",
    glow: "",
  },
  "review-discussion": {
    desc: "Discussed on license-discuss with license text, but never formally submitted for review.",
    badge: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
    tooltip: "bg-violet-50 border-violet-300 dark:bg-violet-950 dark:border-violet-700",
    glow: "",
  },
  // Variants
  osi: {
    desc: "Approved by the Open Source Initiative as meeting the Open Source Definition",
    badge: "bg-[#3da639]/10 text-[#2d7e2a] dark:bg-[#3da639]/15 dark:text-[#5fcc5b]",
    tooltip: "bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-700",
    glow: "shadow-[0_0_8px_rgba(61,166,57,0.3)]",
  },
  fsf: {
    desc: "Classified as a free license by the Free Software Foundation",
    badge: "bg-[#b11107]/10 text-[#8c0d05] dark:bg-[#b11107]/15 dark:text-[#e84940]",
    tooltip: "bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-700",
    glow: "shadow-[0_0_8px_rgba(177,17,7,0.3)]",
  },
  "gpl-2-compatible": {
    desc: "Compatible with GPLv2 per the Free Software Foundation",
    badge: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    tooltip: "bg-rose-50 border-rose-300 dark:bg-rose-950 dark:border-rose-700",
    glow: "shadow-[0_0_8px_rgba(244,63,94,0.2)]",
  },
  "gpl-3-compatible": {
    desc: "Compatible with GPLv3 per the Free Software Foundation",
    badge: "bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
    tooltip: "bg-pink-50 border-pink-300 dark:bg-pink-950 dark:border-pink-700",
    glow: "shadow-[0_0_8px_rgba(236,72,153,0.2)]",
  },
  "fdl-compatible": {
    desc: "Compatible with the GNU Free Documentation License per the FSF",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    tooltip: "bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-700",
    glow: "shadow-[0_0_8px_rgba(245,158,11,0.2)]",
  },
  "non-free": {
    desc: "Classified as non-free by the Free Software Foundation",
    badge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    tooltip: "bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-700",
    glow: "shadow-[0_0_8px_rgba(239,68,68,0.3)]",
  },
  viewpoint: {
    desc: "The FSF has a specific viewpoint on this license's freedom status",
    badge: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    tooltip: "bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-600",
    glow: "",
  },
  verified: {
    desc: "Verified by tl;drLegal — license summary reviewed for accuracy",
    badge: "",
    tooltip: "bg-gradient-to-r from-[#eaf5f0] to-[#e6f4fc] border-[#8dd4b5] dark:from-teal-950 dark:to-sky-950 dark:border-teal-700",
    glow: "shadow-[0_0_8px_rgba(0,150,226,0.3)]",
  },
  "tldrlegal-verified": {
    desc: "Verified by tl;drLegal — license summary reviewed for accuracy",
    badge: "verified-badge",
    tooltip: "bg-gradient-to-r from-[#eaf5f0] to-[#e6f4fc] border-[#8dd4b5] dark:from-teal-950 dark:to-sky-950 dark:border-teal-700",
    glow: "shadow-[0_0_8px_rgba(0,150,226,0.3)]",
  },
  proprietary: {
    desc: "Proprietary license that restricts one or more fundamental usage rights",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    tooltip: "bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-700",
    glow: "shadow-[0_0_8px_rgba(245,158,11,0.3)]",
  },
  // Tags
  permissive: {
    desc: "Minimal restrictions on how the licensed work can be used, modified, and redistributed",
    badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    tooltip: "bg-teal-50 border-teal-300 dark:bg-teal-950 dark:border-teal-700",
    glow: "shadow-[0_0_8px_rgba(20,184,166,0.3)]",
  },
  "public-domain": {
    desc: "Not protected by intellectual property rights — free for anyone to use",
    badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
    tooltip: "bg-cyan-50 border-cyan-300 dark:bg-cyan-950 dark:border-cyan-700",
    glow: "shadow-[0_0_8px_rgba(6,182,212,0.3)]",
  },
  copyleft: {
    desc: "Derivative works must be distributed under the same or compatible license terms",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    tooltip: "bg-rose-50 border-rose-300 dark:bg-rose-950 dark:border-rose-700",
    glow: "shadow-[0_0_8px_rgba(244,63,94,0.3)]",
  },
  "weak-copyleft": {
    desc: "Copyleft applies to the original work but not necessarily to larger combined works",
    badge: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
    tooltip: "bg-pink-50 border-pink-300 dark:bg-pink-950 dark:border-pink-700",
    glow: "shadow-[0_0_8px_rgba(236,72,153,0.3)]",
  },
  "creative-commons": {
    desc: "A license from the Creative Commons framework for sharing creative works",
    badge: "bg-neutral-100 text-neutral-800 border border-neutral-400 dark:bg-neutral-800/60 dark:text-neutral-300 dark:border-neutral-500",
    tooltip: "bg-neutral-50 border-neutral-300 dark:bg-neutral-800 dark:border-neutral-600",
    glow: "shadow-[0_0_8px_rgba(120,120,120,0.3)]",
  },
  gnu: {
    desc: "A license from the GNU Project (Free Software Foundation)",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    tooltip: "bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-700",
    glow: "shadow-[0_0_8px_rgba(245,158,11,0.3)]",
  },
  "gnu-nonfree": {
    desc: "Classified as non-free by the GNU Project / Free Software Foundation",
    badge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    tooltip: "bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-700",
    glow: "shadow-[0_0_8px_rgba(239,68,68,0.3)]",
  },
  modelgo: {
    desc: "A license from the ModelGo framework — CC-style licenses designed for AI models",
    badge: "modelgo-badge text-violet-800 dark:text-violet-300",
    tooltip: "bg-gradient-to-r from-violet-50 to-blue-50 border-violet-300 dark:from-violet-950 dark:to-blue-950 dark:border-violet-700",
    glow: "shadow-[0_0_8px_rgba(124,58,237,0.3)]",
  },
  custom: {
    desc: "Custom license not registered with SPDX or other standard bodies",
    badge: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
    tooltip: "bg-fuchsia-50 border-fuchsia-300 dark:bg-fuchsia-950 dark:border-fuchsia-700",
    glow: "shadow-[0_0_8px_rgba(217,70,239,0.3)]",
  },
  huggingface: {
    desc: "License found on a HuggingFace Hub model",
    badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    tooltip: "bg-yellow-50 border-yellow-300 dark:bg-yellow-950 dark:border-yellow-700",
    glow: "shadow-[0_0_8px_rgba(255,210,30,0.3)]",
  },
  "mcp-server": {
    desc: "License from an MCP (Model Context Protocol) server project",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    tooltip: "bg-sky-50 border-sky-300 dark:bg-sky-950 dark:border-sky-700",
    glow: "shadow-[0_0_8px_rgba(14,165,233,0.3)]",
  },
  "agent-framework": {
    desc: "License from an AI agent framework project",
    badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
    tooltip: "bg-indigo-50 border-indigo-300 dark:bg-indigo-950 dark:border-indigo-700",
    glow: "shadow-[0_0_8px_rgba(99,102,241,0.3)]",
  },
  "agent-skill": {
    desc: "License from an AI agent skill/plugin project",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    tooltip: "bg-emerald-50 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-700",
    glow: "shadow-[0_0_8px_rgba(16,185,129,0.3)]",
  },
  "llm-tool": {
    desc: "License from an LLM tool integration project",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    tooltip: "bg-orange-50 border-orange-300 dark:bg-orange-950 dark:border-orange-700",
    glow: "shadow-[0_0_8px_rgba(249,115,22,0.3)]",
  },
  hardware: {
    desc: "License for open hardware designs, circuits, and physical artifacts",
    badge: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
    tooltip: "bg-lime-50 border-lime-300 dark:bg-lime-950 dark:border-lime-700",
    glow: "shadow-[0_0_8px_rgba(132,204,22,0.3)]",
  },
  // Blue Oak tiers — metallic colors (bo- prefix to avoid key collision with type badge "model")
  "bo-model": {
    desc: "Quality rating from Blue Oak Council",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
    tooltip: "bg-violet-50 border-violet-300 dark:bg-violet-950 dark:border-violet-700",
    glow: "shadow-[0_0_8px_rgba(139,92,246,0.3)]",
  },
  "bo-gold": {
    desc: "Quality rating from Blue Oak Council",
    badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    tooltip: "bg-yellow-50 border-yellow-300 dark:bg-yellow-950 dark:border-yellow-700",
    glow: "shadow-[0_0_8px_rgba(234,179,8,0.3)]",
  },
  "bo-silver": {
    desc: "Quality rating from Blue Oak Council",
    badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700/40 dark:text-zinc-300",
    tooltip: "bg-zinc-50 border-zinc-300 dark:bg-zinc-800 dark:border-zinc-600",
    glow: "shadow-[0_0_8px_rgba(161,161,170,0.3)]",
  },
  "bo-bronze": {
    desc: "Quality rating from Blue Oak Council",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    tooltip: "bg-orange-50 border-orange-300 dark:bg-orange-950 dark:border-orange-700",
    glow: "shadow-[0_0_8px_rgba(234,88,12,0.3)]",
  },
  "bo-lead": {
    desc: "Quality rating from Blue Oak Council",
    badge: "bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-400",
    tooltip: "bg-slate-50 border-slate-300 dark:bg-slate-900 dark:border-slate-700",
    glow: "shadow-[0_0_8px_rgba(100,116,139,0.3)]",
  },
};

const variantFallbacks: Record<BadgeVariant, string> = {
  type: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  tag: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  language: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  osi: "", fsf: "", "fsf-tag": "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", permission: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  condition: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  limitation: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  verified: "",
  "blue-oak": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  themeKey?: string;
}

function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/ /g, "-").replace(/[^a-z0-9-]/g, "");
}

// Variant determines the lookup key: use variant name for special badges, text content for types/tags
function resolveKey(variant: BadgeVariant, text: string): string {
  if (["osi", "fsf", "verified", "language"].includes(variant)) return variant;
  if (variant === "fsf-tag") return normalizeKey(text);
  if (variant === "blue-oak") return "bo-" + normalizeKey(text);
  return normalizeKey(text);
}

export function Badge({ children, variant = "tag", className, themeKey }: BadgeProps) {
  const { t } = useLang();
  const text = themeKey || (typeof children === "string" ? children : "");
  const key = resolveKey(variant, text);
  const theme = themes[key];

  const badge = variant === "verified" ? (
    <span
      className={cn(
        "verified-badge inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className
      )}
    >
      <span>{children}</span>
    </span>
  ) : (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        theme?.badge || variantFallbacks[variant],
        className
      )}
    >
      {variant === "type" && typeof children === "string"
        ? children.charAt(0).toUpperCase() + children.slice(1)
        : children}
    </span>
  );

  const i18nKey = `tagdesc.${key}`;
  const desc = t(i18nKey) !== i18nKey ? t(i18nKey) : (theme?.desc || "");
  if (!desc) return badge;

  const tipStyle = theme?.tooltip || "bg-zinc-100 border-zinc-300 dark:bg-zinc-800 dark:border-zinc-600";
  const tipGlow = theme?.glow || "";

  return (
    <span className="group/badge relative z-0 inline-flex align-middle hover:z-[90] focus-within:z-[90]">
      {badge}
      <span
        className={cn(
          "pointer-events-none absolute top-full left-1/2 z-[100] mt-1.5 hidden -translate-x-1/2 whitespace-normal rounded-lg border px-2.5 py-1.5 text-[11px] font-medium leading-snug text-zinc-700 group-hover/badge:block group-focus-within/badge:block dark:text-zinc-200",
          tipStyle,
          tipGlow,
        )}
        style={{
          width: "max-content",
          maxWidth: 220,
        }}
      >
        {desc}
      </span>
    </span>
  );
}
