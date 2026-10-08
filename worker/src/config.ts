import type { FeedSource } from './types';

/**
 * Fallback feed list used only when the database cannot be reached, so the
 * monitor keeps working even if Supabase has an outage. The database
 * (`public.feed_sources`) is the source of truth; this mirrors migration
 * 20261008000002_seed_feed_sources.sql.
 *
 * Every URL was verified live on 2026-10-08 — see docs/FEEDS-VERIFICATION.md.
 */
export const DEFAULT_FEEDS: FeedSource[] = [
  { name: 'Al Jazeera', feed_url: 'https://www.aljazeera.com/xml/rss/all.xml', website_url: 'https://www.aljazeera.com', is_active: true },
  { name: 'Anadolu Agency', feed_url: 'https://www.aa.com.tr/en/rss/default?cat=live', website_url: 'https://www.aa.com.tr/en', is_active: true },
  { name: 'The Atlantic', feed_url: 'https://www.theatlantic.com/feed/all/', website_url: 'https://www.theatlantic.com', is_active: true },
  { name: 'Middle East Eye', feed_url: 'https://www.middleeasteye.net/rss', website_url: 'https://www.middleeasteye.net', is_active: true },
  { name: 'The Diplomat', feed_url: 'https://thediplomat.com/feed/', website_url: 'https://thediplomat.com', is_active: true },
  { name: 'The New York Times', feed_url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', website_url: 'https://www.nytimes.com', is_active: true },
  { name: 'The Economist', feed_url: 'https://www.economist.com/the-world-this-week/rss.xml', website_url: 'https://www.economist.com', is_active: true },
  { name: 'The Wall Street Journal', feed_url: 'https://feeds.content.dowjones.io/public/rss/RSSWorldNews', website_url: 'https://www.wsj.com', is_active: true },
  { name: 'Foreign Affairs', feed_url: 'https://www.foreignaffairs.com/rss.xml', website_url: 'https://www.foreignaffairs.com', is_active: true },
  { name: 'Financial Times', feed_url: 'https://www.ft.com/rss/home', website_url: 'https://www.ft.com', is_active: true },
  { name: 'Daily Sabah', feed_url: 'https://www.dailysabah.com/rssFeed/rss.xml', website_url: 'https://www.dailysabah.com', is_active: true },
  { name: 'The Washington Post', feed_url: 'https://feeds.washingtonpost.com/rss/world', website_url: 'https://www.washingtonpost.com', is_active: true },
  { name: 'RFI', feed_url: 'https://www.rfi.fr/en/rss', website_url: 'https://www.rfi.fr/en', is_active: true },
  { name: 'Drop Site News', feed_url: 'https://dropsitenews.substack.com/feed', website_url: 'https://www.dropsitenews.com', is_active: true },
  { name: 'Haaretz (World)', feed_url: 'https://www.haaretz.com/srv/world-news-rss', website_url: 'https://www.haaretz.com', is_active: true },
  { name: 'Haaretz (Middle East)', feed_url: 'https://www.haaretz.com/srv/middle-east-news-rss', website_url: 'https://www.haaretz.com', is_active: true },
  { name: 'Axios', feed_url: 'https://api.axios.com/feed/', website_url: 'https://www.axios.com', is_active: true },
  { name: 'POLITICO', feed_url: 'https://rss.politico.com/politics-news.xml', website_url: 'https://www.politico.com', is_active: true },
];

/**
 * Feed sharding.
 *
 * Cloudflare's FREE plan allows only ~10 ms of CPU per invocation (Cron
 * Trigger included), which is not enough to parse 18 feeds in one go. So each
 * invocation handles one "shard" of the feed list, and the cron fires often
 * enough that every source is still polled every 30 minutes:
 *
 *     shard = floor(UTC minute / FEED_SHARD_INTERVAL_MINUTES) % FEED_SHARDS
 *
 * Defaults: 30 slots, one slot per minute, cron ticks every minute. Each
 * invocation therefore handles a single feed (18 feeds across 30 slots — the
 * remaining ticks are no-ops), a source is polled every 30 minutes exactly,
 * and one invocation costs the CPU of one feed instead of eighteen.
 * Heavy feeds (Axios, POLITICO, The Atlantic ship large bodies) are handled by
 * raising FEED_SHARDS (e.g. 60 slots = every 60 minutes per source).
 * Set FEED_SHARDS=1 to process every feed in one run every 30 minutes instead
 * — fine on the Workers Paid plan, or for manual runs.
 */
export const DEFAULT_FEED_SHARDS = 30;
export const DEFAULT_SHARD_INTERVAL_MINUTES = 1;

/** Max articles taken from a single feed per run (Economist ships 300!). */
export const DEFAULT_ITEMS_PER_FEED = 25;
export const MAX_ITEMS_PER_FEED = 100;

/**
 * Max bytes of a feed body we are willing to read. Feeds list newest items
 * first, so cutting the tail is safe and it keeps parser CPU small
 * (Cloudflare's free plan allows ~10 ms CPU per invocation; Axios ships ~1 MB,
 * Drop Site ~700 KB, The Economist 300 items). Because every source is polled
 * every 30 minutes, the newest ~10-20 items per poll are plenty.
 */
export const MAX_BODY_CHARS = 130_000;

/** Per-feed network timeout. */
export const FETCH_TIMEOUT_MS = 12_000;
/** Hard wall-clock budget for the whole fetch phase (Cloudflare cron friendly). */
export const RUN_DEADLINE_MS = 45_000;
/** Parallel feeds. Workers keep up to 6 simultaneous connections per origin. */
export const CONCURRENCY = 6;
/** Max rows per REST insert request. */
export const INSERT_CHUNK_SIZE = 100;

/**
 * User-Agent used for every feed request.
 *
 * NOTE (verified 2026-10-08): Haaretz sits behind Fastly bot protection which
 * returns HTTP 403 for UAs containing "Bot"/"crawler" patterns and for
 * FeedFetcher-Google, while a plain product-style UA is served normally.
 * We stay honest (a real product name, no browser spoofing) — this exact
 * string was verified working on all 18 configured feeds.
 */
export const USER_AGENT = 'NewsMonitor/1.0 (RSS aggregator)';

export const ACCEPT_HEADER =
  'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5';
