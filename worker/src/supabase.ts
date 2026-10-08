/**
 * Thin Supabase REST (PostgREST) client.
 *
 * Uses only fetch() so it runs both in Cloudflare Workers and in Node for the
 * local dry-run. The service_role key is read from Worker secrets only — it is
 * never shipped to the browser and never logged.
 */

import { INSERT_CHUNK_SIZE } from './config';
import type { Env, FeedSource, NewsRow, ScrapeLogRow } from './types';

const REST_TIMEOUT_MS = 15_000;

export class SupabaseError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, message?: string) {
    super(message ?? `Supabase REST error ${status}: ${body.slice(0, 300)}`);
    this.name = 'SupabaseError';
    this.status = status;
    this.body = body;
  }
}

function projectUrl(env: Env): string {
  const url = (env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  if (!url) throw new Error('SUPABASE_URL is not configured');
  return url;
}

function headers(env: Env): Record<string, string> {
  const key = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
    'User-Agent': 'news-monitor-worker',
  };
}

async function rest<T>(
  env: Env,
  path: string,
  init: { method: 'GET' | 'POST' | 'PATCH'; body?: unknown; prefer?: string; signal?: AbortSignal } = { method: 'GET' },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REST_TIMEOUT_MS);
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  try {
    const res = await fetch(`${projectUrl(env)}/rest/v1/${path}`, {
      method: init.method,
      headers: {
        ...headers(env),
        ...(init.prefer ? { Prefer: init.prefer } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new SupabaseError(res.status, text);
    return (text ? JSON.parse(text) : null) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Load active feeds from the DB. Returns null when the DB could not be reached. */
export async function loadFeedSources(env: Env, signal?: AbortSignal): Promise<FeedSource[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const rows = await rest<FeedSource[]>(
      env,
      'feed_sources?select=id,name,feed_url,website_url,is_active&order=name.asc',
      { method: 'GET', signal },
    );
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

export interface FeedStatusUpdate {
  feed_url: string;
  name: string;
  last_checked_at: string;
  last_success_at?: string;
  last_error: string | null;
}

/**
 * Update per-feed health. Success rows and failure rows are sent separately:
 * a failing feed must not wipe the previous `last_success_at`.
 */
export async function updateFeedStatus(env: Env, updates: FeedStatusUpdate[]): Promise<void> {
  const successes = updates.filter((u) => u.last_error === null);
  const failures = updates.filter((u) => u.last_error !== null);
  const post = (rows: Array<Record<string, unknown>>) =>
    rest<unknown>(env, 'feed_sources?on_conflict=feed_url', {
      method: 'POST',
      body: rows,
      prefer: 'resolution=merge-duplicates,return=minimal',
    });

  if (successes.length > 0) await post(successes as unknown as Array<Record<string, unknown>>);
  if (failures.length > 0) await post(failures as unknown as Array<Record<string, unknown>>);
}

export interface InsertNewsResult {
  /** Links actually inserted (new rows). */
  inserted: string[];
  /** Errors that could not be resolved by splitting the batch. */
  errors: string[];
}

/**
 * Bulk insert with duplicate-safety.
 * `on_conflict=link` + `resolution=ignore-duplicates` turns duplicate links into
 * no-ops, and `return=representation` tells us exactly which rows are new.
 * On a 4xx (one bad row) the batch is bisected until the guilty row is isolated.
 */
export async function insertNewsRows(
  env: Env,
  rows: NewsRow[],
  opts: { signal?: AbortSignal } = {},
): Promise<InsertNewsResult> {
  const inserted: string[] = [];
  const errors: string[] = [];

  const chunk = async (batch: NewsRow[]): Promise<void> => {
    if (batch.length === 0) return;
    try {
      const res = await rest<Array<{ link: string }>>(env, 'news?on_conflict=link', {
        method: 'POST',
        body: batch,
        prefer: 'resolution=ignore-duplicates,return=representation',
        signal: opts.signal,
      });
      for (const row of res ?? []) inserted.push(row.link);
    } catch (err) {
      if (batch.length === 1) {
        errors.push(`${batch[0].link} -> ${(err as Error).message.slice(0, 200)}`);
        return;
      }
      const mid = Math.floor(batch.length / 2);
      await chunk(batch.slice(0, mid));
      await chunk(batch.slice(mid));
    }
  };

  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    await chunk(rows.slice(i, i + INSERT_CHUNK_SIZE));
  }
  return { inserted, errors };
}

export async function insertScrapeLogs(env: Env, rows: ScrapeLogRow[]): Promise<void> {
  if (rows.length === 0) return;
  await rest<unknown>(env, 'scrape_logs', {
    method: 'POST',
    body: rows,
    prefer: 'return=minimal',
  });
}
