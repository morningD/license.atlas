export function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function searchLicenses(
  licenses: { title: string; spdx_id: string }[],
  query: string
) {
  const q = query.toLowerCase().trim();
  if (!q) return licenses;
  return licenses.filter(
    (l) => {
      const title = l.title || '';
      const spdxId = l.spdx_id || '';
      return (
        title.toLowerCase().includes(q) ||
        spdxId.toLowerCase().includes(q)
      );
    }
  );
}
