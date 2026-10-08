/**
 * Local dry run — no Cloudflare, no database required.
 *
 *   npm run dry-run                 # every active feed in the built-in list
 *   npm run dry-run -- --all        # same, but ignore ITEMS_PER_FEED cap? (uses 5 per feed)
 *   npx tsx scripts/dry-run.ts --source="Al Jazeera" --source=Axios --items=3
 *
 * If SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are exported, the script talks to
 * the real database (still in dry-run mode by default: nothing is written).
 * Pass --write to actually insert (only do that with a scratch project).
 */

import { DEFAULT_FEEDS } from '../src/config';
import { runOnce } from '../src/run';
import type { Env } from '../src/types';

interface Args {
  sources: string[];
  items?: number;
  write: boolean;
  json: boolean;
  shards: number;
  slot: number;
  allSlots: number;
}

function parseArgs(argv: string[]): Args {
  const sources: string[] = [];
  let items: number | undefined;
  let write = false;
  let json = false;
  let shards = 1;
  let slot = 0;
  let allSlots = 0;
  for (const arg of argv) {
    const [flag, rawValue] = arg.split('=');
    const value = rawValue ?? '';
    if (flag === '--source') sources.push(value);
    else if (flag === '--items') items = Number(value);
    else if (flag === '--write') write = true;
    else if (flag === '--json') json = true;
    else if (flag === '--shards') shards = Number(value) || 1;
    else if (flag === '--slot') slot = Number(value) || 0;
    else if (flag === '--all-slots') allSlots = Number(value) || 30;
  }
  if (allSlots > 0) shards = allSlots;
  return { sources, items, write, json, shards, slot, allSlots };
}

const args = parseArgs(process.argv.slice(2));

const env: Env = {
  SUPABASE_URL: process.env.SUPABASE_URL ?? '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
  ITEMS_PER_FEED: String(args.items ?? 5),
  OG_IMAGE_SCRAPE: process.env.OG_IMAGE_SCRAPE ?? 'false',
};

const hasDb = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

// --all-slots=N : simulate one full cron rotation (N ticks) and report coverage
if (args.allSlots > 0) {
  const coverage = new Map<string, number>();
  let cpuTotal = 0;
  console.log(`Simulating ${args.allSlots} cron ticks with ${args.allSlots} slots…\n`);
  for (let slot = 0; slot < args.allSlots; slot++) {
    const started = performance.now();
    const res = await runOnce(env, {
      trigger: 'cron',
      dryRun: true,
      maxItemsPerFeed: args.items,
      shard: slot,
      shards: args.allSlots,
    });
    const ms = performance.now() - started;
    cpuTotal += ms;
    for (const feed of res.feeds) coverage.set(feed.source_name, (coverage.get(feed.source_name) ?? 0) + 1);
    const okCount = res.feeds.filter((f) => f.status === 'success').length;
    if (res.feeds.length > 0) {
      console.log(
        `tick ${String(slot).padStart(2)}  ${res.feeds[0].source_name.padEnd(24)} ${res.feeds[0].status.padEnd(8)} found=${String(res.feeds[0].items_found).padStart(3)}  ${ms.toFixed(0)}ms`,
      );
    }
    void okCount;
  }
  console.log(`\nCoverage: ${coverage.size} distinct sources in ${args.allSlots} ticks`);
  const missing = DEFAULT_FEEDS.filter((f) => !coverage.has(f.name)).map((f) => f.name);
  const duplicated = [...coverage.entries()].filter(([, n]) => n > 1).map(([name, n]) => `${name} x${n}`);
  console.log(missing.length ? `❌ never polled: ${missing.join(', ')}` : '✅ every source polled at least once');
  console.log(duplicated.length ? `⚠️  polled more than once: ${duplicated.join(', ')}` : '✅ no source polled twice per rotation');
  console.log(`total ${cpuTotal.toFixed(0)} ms across ${args.allSlots} ticks (excl. network waits)`);
  process.exit(missing.length ? 1 : 0);
}

const result = await runOnce(env, {
  trigger: 'manual',
  dryRun: !args.write,
  onlySources: args.sources.length ? args.sources : undefined,
  maxItemsPerFeed: args.items,
  shard: args.slot,
  shards: args.shards,
});

if (args.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
  console.log('');
  console.log(`news-monitor dry run — run_id ${result.run_id}`);
  console.log(`database: ${hasDb ? 'configured (dry-run unless --write)' : 'not configured'}   mode: ${result.dry_run ? 'DRY RUN' : 'WRITE'}`);
  console.log(`source list: ${hasDb ? 'public.feed_sources' : `${DEFAULT_FEEDS.length} built-in fallback feeds`}`);
  console.log('');
  console.log(pad('SOURCE', 26), pad('STATUS', 8), pad('HTTP', 6), pad('FOUND', 6), pad('NEW', 5), pad('MS', 7), 'ERROR / SAMPLE');
  console.log('-'.repeat(120));
  for (const feed of result.feeds) {
    const extra = feed.error_message ?? feed.sample?.[0]?.title ?? '';
    console.log(
      pad(feed.source_name, 26),
      pad(feed.status, 8),
      pad(String(feed.http_status ?? '-'), 6),
      pad(String(feed.items_found), 6),
      pad(String(feed.items_inserted), 5),
      pad(String(feed.duration_ms), 7),
      extra.slice(0, 60),
    );
  }
  console.log('-'.repeat(120));
  console.log(
    `feeds: ${result.feeds_ok} ok / ${result.feeds_failed} failed of ${result.feeds_total}` +
      `   items found: ${result.items_found}   inserted: ${result.items_inserted}   dupes skipped: ${result.duplicates_skipped}` +
      `   total: ${result.duration_ms}ms`,
  );
  const cats = Object.entries(result.categories).sort((a, b) => b[1] - a[1]);
  if (cats.length) console.log('categories:', cats.map(([c, n]) => `${c}=${n}`).join('  '));
  for (const note of result.notes) console.log('note:', note);
  console.log('');
}

process.exit(result.feeds_total > 0 && result.feeds_ok === 0 ? 1 : 0);
