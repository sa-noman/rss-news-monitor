/**
 * One monitoring run: fetch every active feed, normalize, classify, store.
 *
 * Resilience rules from the spec:
 *  - one failing feed must never stop the others
 *  - a broken/renamed URL is logged, not fatal
 *  - duplicates are impossible (unique link + ignore-duplicates upsert)
 */

import { classifyNews } from './classify';
import {
  ACCEPT_HEADER,
  CONCURRENCY,
  DEFAULT_FEEDS,
  DEFAULT_FEED_SHARDS,
  DEFAULT_ITEMS_PER_FEED,
  DEFAULT_SHARD_INTERVAL_MINUTES,
  FETCH_TIMEOUT_MS,
  MAX_BODY_CHARS,
  MAX_ITEMS_PER_FEED,
  RUN_DEADLINE_MS,
  USER_AGENT,
} from './config';
import { parseFeed } from './rss';
import { insertNewsRows, insertScrapeLogs, loadFeedSources, updateFeedStatus, type FeedStatusUpdate } from './supabase';
import type { Env, FeedResult, FeedSource, NewsRow, RunResult, ScrapeLogRow } from './types';

export interface RunOptions {
  trigger?: 'cron' | 'manual';
  dryRun?: boolean;
  onlySources?: string[];
  maxItemsPerFeed?: number;
  /** Process only feeds where `index % shards === shard` (see config.ts). */
  shard?: number;
  shards?: number;
  /** Epoch ms of the scheduled event; used to derive the shard for a cron run. */
  scheduledTime?: number;
}

/** Shard index for "now", derived from the clock (works for any cron expression). */
export function shardForTime(env: Env, scheduledTime: number = Date.now()): { shard: number; shards: number } {
  const shards = clampInt(env.FEED_SHARDS ?? DEFAULT_FEED_SHARDS, 1, 60);
  const interval = clampInt(env.FEED_SHARD_INTERVAL_MINUTES ?? DEFAULT_SHARD_INTERVAL_MINUTES, 1, 60);
  if (shards <= 1) return { shard: 0, shards: 1 };
  const minutes = new Date(scheduledTime).getUTCMinutes();
  return { shard: Math.floor(minutes / interval) % shards, shards };
}

const OG_LIMIT_PER_FEED = 5;

interface FeedOutcome {
  result: FeedResult;
  rows: NewsRow[];
  statusUpdate: FeedStatusUpdate;
}

function log(event: string, data: Record<string, unknown> = {}): void {
  // structured single-line logs -> Cloudflare Workers Logs / `wrangler tail`
  console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...data }));
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

interface FetchOutcome {
  ok: boolean;
  status: number | null;
  body: string;
  finalUrl: string;
  error: string | null;
  attempts: number;
}

/** Read at most `maxChars` of a response body, then cancel the stream. */
async function readCapped(res: Response, maxChars: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, maxChars);
  const decoder = new TextDecoder('utf-8');
  let text = '';
  try {
    while (text.length < maxChars) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* stream already closed */
    }
  }
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

async function fetchFeedText(url: string, timeoutMs: number): Promise<FetchOutcome> {
  let lastError = 'unknown error';
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: ACCEPT_HEADER,
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
      });
      lastStatus = res.status;
      if (!res.ok) {
        lastError = `HTTP ${res.status} ${res.statusText}`.trim();
        // 4xx (except 429) will not improve on retry
        if (res.status < 500 && res.status !== 429) {
          return { ok: false, status: res.status, body: '', finalUrl: res.url || url, error: lastError, attempts: attempt };
        }
      } else {
        const body = await readCapped(res, MAX_BODY_CHARS);
        return { ok: true, status: res.status, body, finalUrl: res.url || url, error: null, attempts: attempt };
      }
    } catch (err) {
      lastError = (err as Error).name === 'AbortError' ? `timeout after ${timeoutMs}ms` : (err as Error).message;
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: lastStatus, body: '', finalUrl: url, error: lastError, attempts: 2 };
}

/** Optional og:image enrichment — disabled unless OG_IMAGE_SCRAPE=true. */
async function fetchOgImage(articleUrl: string, timeoutMs = 6000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(articleUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 200_000);
    const patterns = [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ];
    for (const re of patterns) {
      const m = re.exec(html);
      if (m?.[1]) {
        try {
          const abs = new URL(m[1], articleUrl).toString();
          if (abs.startsWith('http')) return abs;
        } catch {
          /* ignore */
        }
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function processFeed(
  env: Env,
  source: FeedSource,
  maxItems: number,
  deadline: number,
): Promise<FeedOutcome> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  const remaining = Math.max(1500, Math.min(FETCH_TIMEOUT_MS, deadline - Date.now()));

  const base: FeedResult = {
    source_name: source.name,
    feed_url: source.feed_url,
    status: 'error',
    http_status: null,
    items_found: 0,
    items_inserted: 0,
    duplicate_items: 0,
    error_message: null,
    duration_ms: 0,
  };

  const failed = (error: string, httpStatus: number | null = null): FeedOutcome => ({
    result: { ...base, status: 'error', error_message: error, http_status: httpStatus, duration_ms: Date.now() - startedAt },
    rows: [],
    statusUpdate: { feed_url: source.feed_url, name: source.name, last_checked_at: checkedAt, last_error: error.slice(0, 500) },
  });

  if (Date.now() > deadline) return failed('skipped: run deadline reached');

  const fetched = await fetchFeedText(source.feed_url, remaining);
  if (!fetched.ok) return failed(fetched.error ?? 'fetch failed', fetched.status);
  if (fetched.finalUrl !== source.feed_url) {
    log('feed_redirected', { source: source.name, from: source.feed_url, to: fetched.finalUrl });
  }

  const parsed = parseFeed(fetched.body.slice(0, MAX_BODY_CHARS), fetched.finalUrl, { maxItems });
  if (parsed.kind === 'unknown' || parsed.items.length === 0) {
    return failed(
      parsed.kind === 'unknown'
        ? `not an RSS/Atom document (${fetched.body.slice(0, 60).replace(/\s+/g, ' ')}…)`
        : 'feed parsed but contained no items',
      fetched.status,
    );
  }

  const take = parsed.items.slice(0, maxItems);
  const rows: NewsRow[] = take.map((item) => {
    const summaryText = item.summary;
    const classification = classifyNews(item.title, summaryText);
    return {
      title: item.title.slice(0, 500),
      slug: item.slug,
      link: item.link,
      source_name: source.name,
      source_url: source.website_url ?? null,
      category: classification.category,
      summary: summaryText,
      image_url: item.image_url,
      author: item.author,
      published_at: item.published_at,
    };
  });

  // optional, off by default: fill missing images from og:image meta tags only
  if ((env.OG_IMAGE_SCRAPE ?? 'false') === 'true') {
    let enriched = 0;
    for (const row of rows) {
      if (row.image_url || enriched >= OG_LIMIT_PER_FEED) continue;
      if (Date.now() > deadline) break;
      const img = await fetchOgImage(row.link);
      if (img) {
        row.image_url = img;
        enriched++;
      }
    }
    if (enriched > 0) log('og_images_enriched', { source: source.name, count: enriched });
  }

  const result: FeedResult = {
    ...base,
    status: rows.length > 0 ? 'success' : 'empty',
    http_status: fetched.status,
    items_found: parsed.items.length,
    duration_ms: Date.now() - startedAt,
    kind: parsed.kind,
    sample: rows.slice(0, 3).map((r) => ({ title: r.title.slice(0, 90), category: r.category, published_at: r.published_at })),
  };

  return {
    result,
    rows,
    statusUpdate: {
      feed_url: source.feed_url,
      name: source.name,
      last_checked_at: checkedAt,
      last_success_at: checkedAt,
      last_error: null,
    },
  };
}

/** Run the whole pipeline once. */
export async function runOnce(env: Env, opts: RunOptions = {}): Promise<RunResult> {
  const startedAt = Date.now();
  const runId = crypto.randomUUID();
  const trigger = opts.trigger ?? 'manual';
  const deadline = startedAt + RUN_DEADLINE_MS;
  const maxItems = clampInt(opts.maxItemsPerFeed ?? env.ITEMS_PER_FEED ?? DEFAULT_ITEMS_PER_FEED, 1, MAX_ITEMS_PER_FEED);
  const notes: string[] = [];

  const hasDb = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const dryRun = opts.dryRun === true || !hasDb;
  if (!hasDb) notes.push('Supabase credentials missing: ran in dry-run mode, nothing was written.');

  const dbFeeds = await loadFeedSources(env);
  let sources: FeedSource[] = dbFeeds ?? DEFAULT_FEEDS;
  if (!dbFeeds) notes.push('feed_sources unreachable: using built-in default feed list.');

  const shards = Math.max(1, Math.min(60, opts.shards ?? 1));
  const shard = shards > 1 ? (((opts.shard ?? 0) % shards) + shards) % shards : 0;
  if (shards > 1) {
    const before = sources.length;
    sources = sources.filter((_, index) => index % shards === shard);
    notes.push(`shard ${shard + 1}/${shards}: ${sources.length} of ${before} feeds in this invocation`);
  }

  if (opts.onlySources?.length) {
    const wanted = new Set(opts.onlySources.map((s) => s.toLowerCase()));
    sources = sources.filter((s) => wanted.has(s.name.toLowerCase()) || wanted.has(s.feed_url.toLowerCase()));
    notes.push(`filtered to ${sources.length} source(s) via ?source=`); 
  }
  sources = sources.filter((s) => s.is_active !== false);

  log('run_start', {
    run_id: runId,
    trigger,
    dry_run: dryRun,
    shard: shards > 1 ? `${shard + 1}/${shards}` : 'all',
    feeds: sources.length,
    max_items_per_feed: maxItems,
  });

  const queue = [...sources];
  const outcomes: FeedOutcome[] = [];

  const worker = async (): Promise<void> => {
    for (;;) {
      const source = queue.shift();
      if (!source) return;
      let outcome: FeedOutcome;
      try {
        outcome = await processFeed(env, source, maxItems, deadline);
      } catch (err) {
        const message = (err as Error).message ?? 'unknown error';
        outcome = {
          result: {
            source_name: source.name,
            feed_url: source.feed_url,
            status: 'error',
            http_status: null,
            items_found: 0,
            items_inserted: 0,
            duplicate_items: 0,
            error_message: message,
            duration_ms: 0,
          },
          rows: [],
          statusUpdate: {
            feed_url: source.feed_url,
            name: source.name,
            last_checked_at: new Date().toISOString(),
            last_error: message.slice(0, 500),
          },
        };
      }
      outcomes.push(outcome);
      log('feed_done', {
        source: source.name,
        status: outcome.result.status,
        http_status: outcome.result.http_status,
        found: outcome.result.items_found,
        ms: outcome.result.duration_ms,
        error: outcome.result.error_message,
      });
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(CONCURRENCY, queue.length)) }, worker));

  // global dedupe (a story syndicated by two feeds is stored once, first wins)
  const byLink = new Map<string, { row: NewsRow; feedIndex: number }>();
  let duplicates = 0;
  outcomes.forEach((outcome, feedIndex) => {
    for (const row of outcome.rows) {
      if (byLink.has(row.link)) {
        duplicates++;
        outcome.result.duplicate_items++;
        continue;
      }
      byLink.set(row.link, { row, feedIndex });
    }
  });

  const rowsToInsert = [...byLink.values()].map((v) => v.row);
  let insertedLinks: string[] = [];
  let insertErrors: string[] = [];

  if (!dryRun && rowsToInsert.length > 0) {
    const insertResult = await insertNewsRows(env, rowsToInsert);
    insertedLinks = insertResult.inserted;
    insertErrors = insertResult.errors;
    if (insertErrors.length > 0) notes.push(`${insertErrors.length} row(s) failed to insert: ${insertErrors[0]}`);
  } else if (dryRun && rowsToInsert.length > 0) {
    notes.push(`dry-run: ${rowsToInsert.length} normalized row(s) prepared, nothing written.`);
  }

  const insertedSet = new Set(insertedLinks);
  const linkToFeed = new Map<string, number>();
  for (const [link, entry] of byLink) linkToFeed.set(link, entry.feedIndex);
  for (const link of insertedLinks) {
    const feedIndex = linkToFeed.get(link);
    if (feedIndex !== undefined) outcomes[feedIndex].result.items_inserted++;
  }

  // per-feed bookkeeping + logs
  const logRows: ScrapeLogRow[] = outcomes.map((o) => ({
    run_id: runId,
    trigger,
    source_name: o.result.source_name,
    feed_url: o.result.feed_url,
    status: o.result.status,
    http_status: o.result.http_status,
    items_found: o.result.items_found,
    items_inserted: o.result.items_inserted,
    error_message: o.result.error_message,
    duration_ms: o.result.duration_ms,
  }));

  if (!dryRun) {
    try {
      await updateFeedStatus(env, outcomes.map((o) => o.statusUpdate));
    } catch (err) {
      notes.push(`feed status update failed: ${(err as Error).message.slice(0, 200)}`);
    }
    try {
      await insertScrapeLogs(env, logRows);
    } catch (err) {
      notes.push(`scrape_logs write failed: ${(err as Error).message.slice(0, 200)}`);
    }
  }

  const categories: Record<string, number> = {};
  for (const row of rowsToInsert) categories[row.category] = (categories[row.category] ?? 0) + 1;

  const feeds = outcomes.map((o) => o.result).sort((a, b) => a.source_name.localeCompare(b.source_name));
  const result: RunResult = {
    run_id: runId,
    trigger,
    started_at: new Date(startedAt).toISOString(),
    duration_ms: Date.now() - startedAt,
    dry_run: dryRun,
    feeds_total: feeds.length,
    feeds_ok: feeds.filter((f) => f.status === 'success' || f.status === 'empty').length,
    feeds_failed: feeds.filter((f) => f.status === 'error').length,
    items_found: feeds.reduce((sum, f) => sum + f.items_found, 0),
    items_inserted: insertedLinks.length,
    duplicates_skipped: duplicates,
    categories,
    feeds,
    notes,
  };

  log('run_complete', {
    run_id: runId,
    dry_run: dryRun,
    feeds_ok: result.feeds_ok,
    feeds_failed: result.feeds_failed,
    items_found: result.items_found,
    items_inserted: result.items_inserted,
    duration_ms: result.duration_ms,
    notes: result.notes,
  });

  return result;
}
