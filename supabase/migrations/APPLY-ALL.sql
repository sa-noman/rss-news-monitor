-- =============================================================================
-- news-monitor — সম্পূর্ণ স্কিমা এক ফাইলেই (একবার পেস্ট করে Run করলেই হবে)
-- Supabase Dashboard → SQL Editor → New query → এই পুরো ফাইল পেস্ট → Run
-- নিরাপদ: যতবার চালান, সমস্যা নেই (idempotent)
-- =============================================================================

-- =============================================================================
-- News Monitor — Initial schema
-- Project: news-monitor (Cloudflare Worker -> Supabase -> Next.js/Vercel)
-- Safe to run multiple times (idempotent).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) news : aggregated headlines (title / summary / link only — never full text)
-- -----------------------------------------------------------------------------
create table if not exists public.news (
  id           uuid primary key default gen_random_uuid(),
  title        text        not null,
  slug         text,
  link         text        not null,
  source_name  text        not null,
  source_url   text,
  category     text        not null default 'Other',
  summary      text,
  image_url    text,
  author       text,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- one row per article link: this is what makes duplicate inserts impossible
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'news_link_key'
  ) then
    alter table public.news add constraint news_link_key unique (link);
  end if;
end $$;

-- indexes tuned for the website's queries (latest first, filter by category/source)
create index if not exists news_published_at_idx on public.news (published_at desc nulls last);
create index if not exists news_created_at_idx   on public.news (created_at desc);
create index if not exists news_category_idx     on public.news (category);
create index if not exists news_source_name_idx  on public.news (source_name);
create index if not exists news_category_pub_idx on public.news (category, published_at desc nulls last);
-- case-insensitive title search helper (used by the search box)
create index if not exists news_title_lower_idx  on public.news (lower(title) text_pattern_ops);

-- keep updated_at honest
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists news_set_updated_at on public.news;
create trigger news_set_updated_at
  before update on public.news
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2) feed_sources : the list the Worker polls + per-feed health bookkeeping
-- -----------------------------------------------------------------------------
create table if not exists public.feed_sources (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,
  feed_url        text        not null,
  website_url     text,
  is_active       boolean     not null default true,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'feed_sources_feed_url_key') then
    alter table public.feed_sources add constraint feed_sources_feed_url_key unique (feed_url);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'feed_sources_name_key') then
    alter table public.feed_sources add constraint feed_sources_name_key unique (name);
  end if;
end $$;

drop trigger if exists feed_sources_set_updated_at on public.feed_sources;
create trigger feed_sources_set_updated_at
  before update on public.feed_sources
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3) scrape_logs : one row per feed per run (monitoring / debugging)
-- -----------------------------------------------------------------------------
create table if not exists public.scrape_logs (
  id            bigserial primary key,
  run_id        uuid,
  trigger       text,                       -- 'cron' | 'manual'
  source_name   text,
  feed_url      text,
  status        text        not null,       -- 'success' | 'error' | 'empty' | 'skipped'
  http_status   int,
  items_found   int         not null default 0,
  items_inserted int        not null default 0,
  error_message text,
  duration_ms   int,
  created_at    timestamptz not null default now()
);

create index if not exists scrape_logs_created_at_idx on public.scrape_logs (created_at desc);
create index if not exists scrape_logs_source_idx     on public.scrape_logs (source_name, created_at desc);

-- -----------------------------------------------------------------------------
-- 4) Row Level Security
--    Public (anon) key  -> read-only on news/feed_sources/scrape_logs
--    Service role key   -> full access (bypasses RLS) — used only by the Worker
-- -----------------------------------------------------------------------------
alter table public.news         enable row level security;
alter table public.feed_sources enable row level security;
alter table public.scrape_logs  enable row level security;

drop policy if exists "news_public_read" on public.news;
create policy "news_public_read"
  on public.news for select
  to anon, authenticated
  using (true);

drop policy if exists "feed_sources_public_read" on public.feed_sources;
create policy "feed_sources_public_read"
  on public.feed_sources for select
  to anon, authenticated
  using (true);

drop policy if exists "scrape_logs_public_read" on public.scrape_logs;
create policy "scrape_logs_public_read"
  on public.scrape_logs for select
  to anon, authenticated
  using (true);

-- NOTE: intentionally no insert/update/delete policies.
-- Only the service_role key (Worker secret) can write.

-- -----------------------------------------------------------------------------
-- 5) Realtime: broadcast new inserts to the website
-- -----------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.news;
  exception
    when duplicate_object then null;   -- already part of the publication
    when undefined_object then null;   -- publication not present (local plain PG)
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 6) Handy read-only view: per-category counters for the filter chips
-- -----------------------------------------------------------------------------
drop view if exists public.news_category_stats;
create view public.news_category_stats
with (security_invoker = true)
as
  select category,
         count(*)::int              as item_count,
         max(published_at)          as latest_at
  from public.news
  group by category;

grant select on public.news, public.feed_sources, public.scrape_logs, public.news_category_stats
  to anon, authenticated;

-- =============================================================================
-- Seed the monitored RSS feeds.
-- Every URL below was verified live on 2026-10-08 (HTTP 200 + parseable items).
-- See docs/FEEDS-VERIFICATION.md for the raw evidence and for the 4 URLs that had
-- to be replaced (Anadolu, WSJ, Haaretz, POLITICO).
-- Idempotent: ON CONFLICT (feed_url) DO UPDATE keeps health columns untouched
-- but refreshes name/website/is_active.
-- =============================================================================

insert into public.feed_sources (name, feed_url, website_url, is_active) values
  ('Al Jazeera',              'https://www.aljazeera.com/xml/rss/all.xml',                                  'https://www.aljazeera.com',              true),
  ('Anadolu Agency',          'https://www.aa.com.tr/en/rss/default?cat=live',                              'https://www.aa.com.tr/en',               true),
  ('The Atlantic',            'https://www.theatlantic.com/feed/all/',                                      'https://www.theatlantic.com',            true),
  ('Middle East Eye',         'https://www.middleeasteye.net/rss',                                          'https://www.middleeasteye.net',          true),
  ('The Diplomat',            'https://thediplomat.com/feed/',                                              'https://thediplomat.com',                true),
  ('The New York Times',      'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',                 'https://www.nytimes.com',                true),
  ('The Economist',           'https://www.economist.com/the-world-this-week/rss.xml',                      'https://www.economist.com',              true),
  -- Original https://feeds.a.dj.com/rss/RSSWorldNews.xml went stale in Jan 2025.
  ('The Wall Street Journal', 'https://feeds.content.dowjones.io/public/rss/RSSWorldNews',                 'https://www.wsj.com',                    true),
  ('Foreign Affairs',         'https://www.foreignaffairs.com/rss.xml',                                    'https://www.foreignaffairs.com',         true),
  ('Financial Times',         'https://www.ft.com/rss/home',                                               'https://www.ft.com',                     true),
  ('Daily Sabah',             'https://www.dailysabah.com/rssFeed/rss.xml',                                'https://www.dailysabah.com',             true),
  ('The Washington Post',     'https://feeds.washingtonpost.com/rss/world',                                'https://www.washingtonpost.com',         true),
  ('RFI',                     'https://www.rfi.fr/en/rss',                                                 'https://www.rfi.fr/en',                  true),
  ('Drop Site News',          'https://dropsitenews.substack.com/feed',                                    'https://www.dropsitenews.com',           true),
  -- Original https://www.haaretz.com/srv/rss returns 404. Two live section feeds:
  ('Haaretz (World)',         'https://www.haaretz.com/srv/world-news-rss',                                'https://www.haaretz.com',                true),
  ('Haaretz (Middle East)',   'https://www.haaretz.com/srv/middle-east-news-rss',                          'https://www.haaretz.com',                true),
  ('Axios',                   'https://api.axios.com/feed/',                                               'https://www.axios.com',                  true),
  -- Original https://www.politico.com/rss/politicopicks.xml is behind a bot wall (403).
  ('POLITICO',                'https://rss.politico.com/politics-news.xml',                                'https://www.politico.com',               true)
on conflict (feed_url) do update
  set name        = excluded.name,
      website_url = excluded.website_url,
      is_active   = excluded.is_active;

-- -----------------------------------------------------------------------------
-- Feeds intentionally not active in v1 (kept for reference / future work):
--   Reuters, AFP, Ground News, NewsNow, Clash Report  -- excluded by request
--   Haaretz (Israel)  https://www.haaretz.com/srv/israel-news-rss  -- works, add if wanted
--   Anadolu (World)   https://www.aa.com.tr/en/rss/default?cat=world -- works, add if wanted
--   POLITICO (EU)     https://www.politico.eu/feed/                -- works, add if wanted
-- -----------------------------------------------------------------------------
