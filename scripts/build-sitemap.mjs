// Build script: generates public/sitemap.xml from licenses-index.json
// Run: node scripts/build-sitemap.mjs
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const BASE = "https://morningd.github.io/license.atlas";
const today = new Date().toISOString().split("T")[0];

try {
  const licenses = JSON.parse(
    readFileSync(resolve(root, "src/data/licenses-index.json"), "utf-8")
  );

  const urls = [
    { loc: `${BASE}/`, changefreq: "weekly", priority: "1.0", lastmod: today },
    { loc: `${BASE}/about`, changefreq: "monthly", priority: "0.8", lastmod: today },
    { loc: `${BASE}/tracker`, changefreq: "weekly", priority: "0.8", lastmod: today },
    ...licenses.map((lic) => ({
      loc: `${BASE}/licenses/${lic.slug}`,
      changefreq: "monthly",
      priority: "0.6",
      lastmod: lic.created_at || today,
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

  const outPath = resolve(root, "public/sitemap.xml");
  writeFileSync(outPath, xml);
  console.log(`✓ Sitemap generated: ${urls.length} URLs → public/sitemap.xml`);
} catch (err) {
  console.error(`✗ Failed to build sitemap: ${err.message}`);
  process.exit(1);
}
