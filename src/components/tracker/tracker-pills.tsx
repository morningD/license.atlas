// Shared pill styling + i18n labels for tracker entities (sentiment, roles).
// Used by both the summary timeline rows and the full-text nav/detail views.

export const SENT_PILL: Record<string, string> = {
  positive: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  support: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  negative: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  oppose: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  question: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  mixed: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

export function sentimentPill(type: string, sentiment?: string | null): string | null {
  if (!sentiment || type !== "feedback") return null;
  const s = sentiment.toLowerCase();
  return SENT_PILL[s] || null;
}

export function sentimentLabel(sentiment: string | undefined | null, t: (key: string) => string) {
  if (!sentiment) return "";
  const key = `tracker.sentiment-${sentiment.toLowerCase()}`;
  const translated = t(key);
  return translated !== key ? translated : sentiment;
}

const ROLE_CLASS: Record<string, string> = {
  submitter: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  board_member: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  reviewer: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  participant: "bg-zinc-50 text-zinc-400 dark:bg-zinc-800/60",
};

export function roleKey(role?: string) {
  return (role || "participant").replace(/[-\s]+/g, "_").toLowerCase();
}

export function roleLabel(role: string | undefined, t: (key: string) => string) {
  const key = roleKey(role);
  const i18nKey = `tracker.role-${key}`;
  const translated = t(i18nKey);
  if (translated !== i18nKey) return translated;
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function rolePillClass(role?: string) {
  return ROLE_CLASS[roleKey(role)] || ROLE_CLASS.participant;
}

// Archive "from" strings can be quoted and carry an alias suffix
// ('"D 莫名 (dewitt)"' → 'D 莫名'); participants names are clean.
export function normSender(name?: string | null) {
  return (name || "").trim().replace(/^"|"$/g, "").replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
}
