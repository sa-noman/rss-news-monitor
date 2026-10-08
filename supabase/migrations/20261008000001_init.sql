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
