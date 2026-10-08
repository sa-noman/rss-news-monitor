/**
 * CPU benchmark for the parse + classify + normalize pipeline.
 *
 *   npx tsx scripts/bench.ts [--iterations=5] [--items=40]
 *
 * Why: Cloudflare's FREE plan allows only ~10 ms of CPU per invocation, while
 * wall-clock time spent waiting on the network does not count. This script
 * isolates the CPU part (fetch once, then parse in a loop) so you can see how
 * much headroom a 30-minute run actually uses. If a full run exceeds the free
 * budget, lower ITEMS_PER_FEED, raise MAX_BODY_CHARS trimming, or split feeds
 * across staggered cron triggers (see docs/DEPLOY.md → "CPU budget").
 */

import { ACCEPT_HEADER, DEFAULT_FEEDS, DEFAULT_ITEMS_PER_FEED, MAX_BODY_CHARS, USER_AGENT } from '../src/config';
import { classifyNews } from '../src/classify';
import { parseFeed } from '../src/rss';

function arg(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
}

const iterations = arg('iterations', 5);
const itemsPerFeed = arg('items', DEFAULT_ITEMS_PER_FEED);
const shards = arg('shards', 1);
const allShards = process.argv.includes('--all-shards');

async function download(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: ACCEPT_HEADER, 'Accept-Language': 'en-US,en;q=0.9' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.text()).slice(0, MAX_BODY_CHARS);
}

console.log(`Downloading ${DEFAULT_FEEDS.length} feeds (one-time)…`);
const bodies = new Map<string, string>();
await Promise.all(
  DEFAULT_FEEDS.map(async (feed) => {
    try {
      bodies.set(feed.feed_url, await download(feed.feed_url));
    } catch (err) {
      console.log(`  ! ${feed.name}: ${(err as Error).message}`);
    }
  }),
);
const totalBytes = [...bodies.values()].reduce((sum, b) => sum + b.length, 0);
console.log(`Got ${bodies.size}/${DEFAULT_FEEDS.length} feeds, ${(totalBytes / 1024).toFixed(0)} KB total.\n`);

function runPipeline(shard = -1): { ms: number; items: number; feeds: number; parseMs: number; classifyMs: number } {
  const started = performance.now();
  let items = 0;
  let feedsInShard = 0;
  let parseMs = 0;
  let classifyMs = 0;
  for (const [index, feed] of DEFAULT_FEEDS.entries()) {
    if (shard >= 0 && shards > 1 && index % shards !== shard) continue;
    const body = bodies.get(feed.feed_url);
    if (!body) continue;
    feedsInShard++;
    const t0 = performance.now();
    const parsed = parseFeed(body, feed.feed_url, { maxItems: itemsPerFeed });
    parseMs += performance.now() - t0;
    const t1 = performance.now();
    for (const item of parsed.items) {
      classifyNews(item.title, item.summary);
      items++;
    }
    classifyMs += performance.now() - t1;
  }
  return { ms: performance.now() - started, items, feeds: feedsInShard, parseMs, classifyMs };
}

if (allShards) {
  const repeats = Math.max(1, arg('repeats', 5));
  runPipeline(0); // warm-up (JIT + regex compilation)
  console.log(`Per-slot CPU cost (${shards} slots, ${itemsPerFeed} items/feed, best of ${repeats}):\n`);
  console.log('  slot  feed                     items   total   parse  classify');
  const perShard = new Map<number, number>();
  for (let shard = 0; shard < shards; shard++) {
    let best: { ms: number; items: number; feeds: number; parseMs: number; classifyMs: number } | null = null;
    for (let r = 0; r < repeats; r++) {
      const res = runPipeline(shard);
      if (!best || res.ms < best.ms) best = res;
    }
    perShard.set(shard, best!.ms);
    if (best!.feeds > 0) {
      const feed = DEFAULT_FEEDS.filter((_, i) => i % shards === shard)[0];
      console.log(
        `  ${String(shard + 1).padStart(4)}  ${(feed?.name ?? '').padEnd(22)} ${String(best!.items).padStart(5)} ${best!.ms.toFixed(2).padStart(7)} ${best!.parseMs.toFixed(2).padStart(7)} ${best!.classifyMs.toFixed(2).padStart(9)}`,
      );
    }
  }
  const worst = Math.max(...perShard.values());
  const sum = [...perShard.values()].reduce((a, b) => a + b, 0);
  console.log(`\nworst slot ${worst.toFixed(2)} ms · all slots together ${sum.toFixed(1)} ms`);
  console.log('Cloudflare free plan CPU budget: 10 ms per invocation.');
  console.log(
    worst <= 7
      ? '✅ Every shard fits the free plan with margin.'
      : worst <= 10
        ? '⚠️  Every shard fits, but with little margin — lower ITEMS_PER_FEED or add a shard.'
        : '❌ A shard exceeds the free budget — increase FEED_SHARDS or lower ITEMS_PER_FEED.',
  );
} else {
  runPipeline(shards > 1 ? 0 : -1); // warm-up

  const results: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const { ms, items, feeds } = runPipeline(shards > 1 ? 0 : -1);
    results.push(ms);
    console.log(`run ${i + 1}: ${ms.toFixed(1)} ms  (${feeds} feeds, ${items} items classified)`);
  }

  const best = Math.min(...results);
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  console.log(`\nbest ${best.toFixed(1)} ms · avg ${avg.toFixed(1)} ms`);
  console.log('Cloudflare free plan CPU budget: ~10 ms/invocation, paid: 30 s.');
  console.log(
    best <= 10
      ? '✅ Fits the free plan comfortably for the parse/classify part.'
      : '⚠️  Parse/classify alone exceeds the FREE plan budget — run with --all-shards to see the sharded layout.',
  );
}
