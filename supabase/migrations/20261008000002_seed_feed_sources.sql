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
