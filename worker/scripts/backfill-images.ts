/**
 * One-time image backfill for existing stories.
 * Dry-run by default. Run with:
 *   cd worker && SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-images.ts
 * Add --write to PATCH only rows whose image_url is NULL.
 * Add --limit=20 to bound requests (hard maximum 100 per invocation).
 */
import { articleImageFromHtml } from '../src/run';

const endpoint = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const write = process.argv.includes('--write');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = Math.max(1, Math.min(100, Number(limitArg?.split('=')[1] || 20) || 20));
if (!endpoint || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

const headers = { apikey: key, Authorization: 'Bearer ' + key };
const select = new URL(endpoint + '/rest/v1/news');
select.searchParams.set('select', 'id,link,image_url');
select.searchParams.set('image_url', 'is.null');
select.searchParams.set('order', 'created_at.desc');
select.searchParams.set('limit', String(limit));

const response = await fetch(select, { headers });
if (!response.ok) throw new Error('Supabase read failed: HTTP ' + response.status);
const rows = await response.json() as Array<{ id: string; link: string; image_url: null }>;
let found = 0;
let changed = 0;
for (const row of rows) {
  let image: string | null = null;
  try {
    const article = new URL(row.link);
    if (!['http:', 'https:'].includes(article.protocol)) continue;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const page = await fetch(article, { signal: controller.signal, headers: { Accept: 'text/html' } });
      if (!page.ok || !(page.headers.get('content-type') ?? '').includes('text/html')) continue;
      // Stream only the start of the document; OG tags normally live in <head>.
      const reader = page.body?.getReader();
      let html = '';
      const decoder = new TextDecoder();
      if (reader) {
        while (html.length < 120_000) {
          const chunk = await reader.read();
          if (chunk.done) break;
          html += decoder.decode(chunk.value, { stream: true });
        }
        await reader.cancel().catch(() => {});
      }
      image = articleImageFromHtml(html, page.url || article.href);
    } finally {
      clearTimeout(timer);
    }
  } catch { /* publisher may block automated image metadata retrieval */ }
  if (!image) continue;
  found++;
  if (write) {
    const url = endpoint + '/rest/v1/news?id=eq.' + encodeURIComponent(row.id) + '&image_url=is.null';
    const patch = await fetch(url, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ image_url: image }),
    });
    if (!patch.ok) {
      console.error('Backfill failed for article', row.id, 'HTTP', patch.status);
      continue;
    }
    changed++;
  }
}
console.log(JSON.stringify({ scanned: rows.length, images_found: found, rows_updated: changed, dry_run: !write }));
