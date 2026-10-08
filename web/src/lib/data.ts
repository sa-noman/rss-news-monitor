import { demoFeedSources, demoNews, demoScrapeLogs } from './demo-data';
import { getServerClient, supabaseConfigured } from './supabase';
import type { CategoryStat, FeedSourceRow, NewsItem, NewsQueryResult, ScrapeLogRow } from './types';

export const NEWS_PAGE_SIZE = 24;

export interface NewsFilters {
  category?: string;
  source?: string;
  q?: string;
  page?: number;
}

/** PostgREST `or=(...)` filters break on these characters — drop them. */
export function sanitizeSearch(input: string | undefined): string {
  return (input ?? '').replace(/[,()"'\\%*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function matchesFilters(item: NewsItem, filters: NewsFilters): boolean {
  if (filters.category && filters.category !== 'All' && item.category !== filters.category) return false;
  if (filters.source && item.source_name !== filters.source) return false;
  if (filters.q) {
    const needle = filters.q.toLowerCase();
    const haystack = `${item.title} ${item.summary ?? ''} ${item.source_name}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export async function fetchNews(filters: NewsFilters = {}): Promise<NewsQueryResult> {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * NEWS_PAGE_SIZE;
  const to = from + NEWS_PAGE_SIZE - 1;
  const q = sanitizeSearch(filters.q);
  const category = filters.category && filters.category !== 'All' ? filters.category : undefined;

  const supabase = getServerClient();
  if (!supabase) {
    const all = demoNews().filter((item) => matchesFilters(item, { ...filters, q }));
    return { items: all.slice(from, from + NEWS_PAGE_SIZE), total: all.length, mode: 'demo' };
  }

  try {
    let query = supabase
      .from('news')
      .select('*', { count: 'exact' })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (category) query = query.eq('category', category);
    if (filters.source) query = query.eq('source_name', filters.source);
    if (q) query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    return { items: (data ?? []) as NewsItem[], total: count ?? 0, mode: 'live' };
  } catch (err) {
    const all = demoNews().filter((item) => matchesFilters(item, { ...filters, q }));
    return {
      items: all.slice(from, from + NEWS_PAGE_SIZE),
      total: all.length,
      mode: 'demo',
      error: (err as Error).message,
    };
  }
}

export async function fetchCategoryStats(): Promise<CategoryStat[]> {
  const supabase = getServerClient();
  if (!supabase) return statsFromDemo();
  try {
    const { data, error } = await supabase.from('news_category_stats').select('category,item_count,latest_at');
    if (error) throw error;
    const rows = (data ?? []) as CategoryStat[];
    if (rows.length === 0) return [];
    return rows;
  } catch {
    return statsFromDemo();
  }
}

function statsFromDemo(): CategoryStat[] {
  const map = new Map<string, CategoryStat>();
  for (const item of demoNews()) {
    const existing = map.get(item.category);
    if (existing) {
      existing.item_count += 1;
      if ((item.published_at ?? '') > (existing.latest_at ?? '')) existing.latest_at = item.published_at;
    } else {
      map.set(item.category, { category: item.category, item_count: 1, latest_at: item.published_at });
    }
  }
  return [...map.values()].sort((a, b) => b.item_count - a.item_count);
}

export interface SourcesResult {
  sources: FeedSourceRow[];
  mode: 'live' | 'demo';
  error?: string;
}

export async function fetchSources(): Promise<SourcesResult> {
  const supabase = getServerClient();
  if (!supabase) return { sources: demoFeedSources(), mode: 'demo' };
  try {
    const { data, error } = await supabase
      .from('feed_sources')
      .select('name,feed_url,website_url,is_active,last_checked_at,last_success_at,last_error')
      .order('name', { ascending: true });
    if (error) throw error;
    return { sources: (data ?? []) as FeedSourceRow[], mode: 'live' };
  } catch (err) {
    return { sources: demoFeedSources(), mode: 'demo', error: (err as Error).message };
  }
}

export async function fetchRecentLogs(limit = 40): Promise<{ logs: ScrapeLogRow[]; mode: 'live' | 'demo' }> {
  const supabase = getServerClient();
  if (!supabase) return { logs: demoScrapeLogs().slice(0, limit), mode: 'demo' };
  try {
    const { data, error } = await supabase
      .from('scrape_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { logs: (data ?? []) as ScrapeLogRow[], mode: 'live' };
  } catch {
    return { logs: demoScrapeLogs().slice(0, limit), mode: 'demo' };
  }
}

export const supabaseIsConfigured = supabaseConfigured;
