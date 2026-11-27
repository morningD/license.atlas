import MiniSearch from 'minisearch';
import { readFileSync, writeFileSync } from 'fs';

try {
  const licenses = JSON.parse(readFileSync('src/data/licenses.json', 'utf-8'));

  const ms = new MiniSearch({
    fields: ['title', 'spdx_id', 'sources', 'description', 'body'],
    storeFields: ['slug', 'title', 'spdx_id', 'type'],
    idField: 'slug',
  });

  const docs = licenses.map(l => ({
    slug: l.slug,
    title: l.title,
    spdx_id: l.spdx_id || '',
    type: l.type,
    description: l.description || '',
    sources: (l.sources || []).map(s => s.name).join(' '),
    body: (l.body || '').slice(0, 5000),
  }));

  ms.addAll(docs);

  const json = JSON.stringify(ms);
  const size = Buffer.byteLength(json);
  writeFileSync('public/search-index.json', json);

  console.log(`✓ Search index built: ${docs.length} docs, ${(size / 1024 / 1024).toFixed(1)}MB`);
} catch (err) {
  // Keep the stack: it names the exact file and line that failed.
  console.error(`✗ Failed to build search index: ${err.stack || err}`);
  process.exit(1);
}
