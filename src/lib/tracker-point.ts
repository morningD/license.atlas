// LLM-extracted points are single-sentence summaries. When extraction lags or
// is blocked (e.g. provider content filter), the build falls back to a raw
// clean_body slice that can carry hard newlines — normalize them so timeline
// tooltips and event lists never render broken multi-line text.
export function cleanTrackerPoint(s: string | null | undefined): string {
  return (s || "").replace(/\s*\n+\s*/g, " ").trim();
}
