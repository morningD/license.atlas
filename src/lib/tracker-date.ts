// SPDX-License-Identifier: MulanPSL-2.0

export function formatTrackerDate(date?: string | null): string {
  if (!date) return "?";
  if (/^\d{8}$/.test(date)) {
    return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  }
  return date;
}

export function formatTrackerShortDate(date?: string | null): string {
  if (!date) return "?";
  if (/^\d{8}$/.test(date)) return `${date.slice(4, 6)}-${date.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(5, 10);
  return date;
}
