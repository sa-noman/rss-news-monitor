/** Types mirroring the Supabase schema (supabase/migrations/20261008000001_init.sql). */

export const CATEGORIES = [
  'World',
  'Politics',
  'War & Conflict',
  'Economy & Business',
  'Technology',
  'Science',
  'Health',
  'Climate',
  'Sports',
  'Culture & Entertainment',
  'Middle East',
  'South Asia',
  'Opinion',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface NewsItem {
  id: string;
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
  created_at: string;
}

export interface FeedSourceRow {
  name: string;
  feed_url: string;
  website_url: string | null;
  is_active: boolean;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
}

export interface ScrapeLogRow {
  id: number;
  run_id: string | null;
  trigger: string | null;
  source_name: string | null;
  feed_url: string | null;
  status: string;
  http_status: number | null;
  items_found: number;
  items_inserted: number;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface CategoryStat {
  category: string;
  item_count: number;
  latest_at: string | null;
}

export interface NewsQueryResult {
  items: NewsItem[];
  total: number;
  /** 'live' = Supabase answered, 'demo' = bundled sample data (no credentials) */
  mode: 'live' | 'demo';
  /** set when a live query failed and we fell back to demo data */
  error?: string;
}
