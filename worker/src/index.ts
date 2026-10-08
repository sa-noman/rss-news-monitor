/**
 * Cloudflare Worker entry point.
 *
 *  - `scheduled` : Cron Trigger (every 30 minutes) -> runOnce()
 *  - `fetch`     : tiny ops surface
 *        GET  /            -> service info
 *        GET  /health      -> liveness probe
 *        POST /run         -> manual run (needs ADMIN_TOKEN)
 *        POST /run?dry=1   -> parse only, no DB writes (needs ADMIN_TOKEN)
 *
 * Secrets live in Worker secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * ADMIN_TOKEN. None of them are ever returned to a client.
 */

import { DEFAULT_FEEDS } from './config';
import { runOnce, shardForTime } from './run';
import type { Env, RunResult } from './types';

const VERSION = '1.0.0';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** Constant-time-ish token check (avoids leaking length via timing). */
function tokenMatches(provided: string | null, expected: string | undefined): boolean {
  if (!expected) return false;
  if (!provided) return false;
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function summarize(result: RunResult): Record<string, unknown> {
  return {
    run_id: result.run_id,
    trigger: result.trigger,
    dry_run: result.dry_run,
    duration_ms: result.duration_ms,
    feeds_ok: result.feeds_ok,
    feeds_failed: result.feeds_failed,
    items_found: result.items_found,
    items_inserted: result.items_inserted,
    duplicates_skipped: result.duplicates_skipped,
    categories: result.categories,
    notes: result.notes,
    failed_feeds: result.feeds
      .filter((f) => f.status === 'error')
      .map((f) => ({ source: f.source_name, error: f.error_message, http_status: f.http_status })),
  };
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // The feed list is split into shards so a single invocation stays inside
    // Cloudflare's free-plan CPU budget (~10 ms). Every source is still polled
    // every 30 minutes because the cron fires every FEED_SHARD_INTERVAL_MINUTES.
    const { shard, shards } = shardForTime(env, Number(controller.scheduledTime ?? Date.now()));
    const task = runOnce(env, { trigger: 'cron', shard, shards }).catch((err: unknown) => {
      console.error(JSON.stringify({ event: 'run_failed', error: (err as Error).message }));
    });
    ctx.waitUntil(task);
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'GET' && (path === '/' || path === '')) {
      return json({
        service: 'news-monitor-worker',
        version: VERSION,
        schedule: '*/30 * * * * (Cloudflare Cron Trigger)',
        endpoints: {
          'GET /health': 'liveness + configuration status',
          'POST /run': 'run one monitoring cycle (Authorization: Bearer $ADMIN_TOKEN); add ?dry=1 to skip DB writes',
        },
        feeds_in_fallback_list: DEFAULT_FEEDS.length,
        cron: `every ${env.FEED_SHARD_INTERVAL_MINUTES ?? '1'} min, ${env.FEED_SHARDS ?? '30'} slot(s) -> each source polled every 30 min`,
        time: new Date().toISOString(),
      });
    }

    if (request.method === 'GET' && path === '/health') {
      return json({
        ok: true,
        version: VERSION,
        supabase_configured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
        admin_token_configured: Boolean(env.ADMIN_TOKEN),
        items_per_feed: env.ITEMS_PER_FEED ?? '25',
        feed_slots: env.FEED_SHARDS ?? '30',
        slot_interval_minutes: env.FEED_SHARD_INTERVAL_MINUTES ?? '1',
        og_image_scrape: env.OG_IMAGE_SCRAPE ?? 'false',
        time: new Date().toISOString(),
      });
    }

    if (path === '/run') {
      if (request.method !== 'POST' && request.method !== 'GET') {
        return json({ error: 'method not allowed; use POST /run' }, 405);
      }
      const auth = request.headers.get('authorization');
      const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null;
      const token = bearer ?? url.searchParams.get('token');
      if (!env.ADMIN_TOKEN) {
        return json({ error: 'ADMIN_TOKEN is not configured on this Worker; manual runs are disabled.' }, 403);
      }
      if (!tokenMatches(token, env.ADMIN_TOKEN)) {
        return json({ error: 'unauthorized' }, 401);
      }

      const dryRun = ['1', 'true', 'yes'].includes((url.searchParams.get('dry') ?? '').toLowerCase());
      const onlySources = url.searchParams.getAll('source').flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);
      const maxItems = url.searchParams.get('items') ?? undefined;
      // manual runs default to "all feeds"; ?shards=6&shard=2 is available for parity with cron
      const shards = Number(url.searchParams.get('shards') ?? '1') || 1;
      const shard = Number(url.searchParams.get('shard') ?? '0') || 0;

      try {
        const result = await runOnce(env, {
          trigger: 'manual',
          dryRun,
          onlySources,
          maxItemsPerFeed: maxItems ? Number(maxItems) : undefined,
          shard,
          shards,
        });
        const body: Record<string, unknown> = summarize(result);
        if (dryRun) {
          body.preview = result.feeds
            .filter((f) => f.status !== 'error')
            .slice(0, 5)
            .map((f) => ({ source: f.source_name, items_found: f.items_found, sample: f.sample }));
        }
        return json(body);
      } catch (err) {
        console.error(JSON.stringify({ event: 'manual_run_failed', error: (err as Error).message }));
        return json({ error: 'run failed', message: (err as Error).message }, 500);
      }
    }

    return json({ error: 'not found', endpoints: ['/', '/health', 'POST /run'] }, 404);
  },
} satisfies ExportedHandler<Env>;
