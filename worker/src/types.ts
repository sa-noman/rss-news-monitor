/** Shared types for the Worker. */

export interface Env {
  /** Supabase project URL, e.g. https://xyzcompany.supabase.co (Worker secret) */
  SUPABASE_URL: string;
  /** service_role key — server-side only (Worker secret) */
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Optional bearer token protecting the manual POST /run endpoint */
  ADMIN_TOKEN?: string;
  /** Max items taken per feed per run (default 25) */
  ITEMS_PER_FEED?: string;
  /** Slot count for feed rotation (default 30 = one feed per cron tick, see config.ts) */
  FEED_SHARDS?: string;
  /** Minutes between slots (default 1) */
  FEED_SHARD_INTERVAL_MINUTES?: string;
  /** 'true' enables og:image enrichment (off until explicitly approved) */
  OG_IMAGE_SCRAPE?: string;
  WORKER_VERSION?: string;
}

export interface FeedSource {
  id?: string;
  name: string;
  feed_url: string;
  website_url?: string | null;
  is_active: boolean;
}

export interface ParsedItem {
  title: string;
  link: string;
  slug: string | null;
  summary: string | null;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
  raw_categories: string[];
}

/** A row ready for the `news` table. */
export interface NewsRow {
  title: string;
  slug: string | null;
  link: string;
  source_name: string;
  source_url: string | null;
  category: string;
  summary: string | null;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
}

export type FeedStatus = 'success' | 'empty' | 'error' | 'skipped';

export interface FeedResult {
  source_name: string;
  feed_url: string;
  status: FeedStatus;
  http_status: number | null;
  items_found: number;
  items_inserted: number;
  duplicate_items: number;
  error_message: string | null;
  duration_ms: number;
  kind?: 'rss' | 'atom' | 'unknown';
  sample?: Array<{ title: string; category: string; published_at: string | null }>;
}

export interface ScrapeLogRow {
  run_id: string;
  trigger: 'cron' | 'manual';
  source_name: string;
  feed_url: string;
  status: FeedStatus;
  http_status: number | null;
  items_found: number;
  items_inserted: number;
  error_message: string | null;
  duration_ms: number;
}

export interface RunResult {
  run_id: string;
  trigger: 'cron' | 'manual';
  started_at: string;
  duration_ms: number;
  dry_run: boolean;
  feeds_total: number;
  feeds_ok: number;
  feeds_failed: number;
  items_found: number;
  items_inserted: number;
  duplicates_skipped: number;
  categories: Record<string, number>;
  feeds: FeedResult[];
  notes: string[];
}
