-- Add exactly six requested publisher feeds to an existing News Monitor database.
-- Safe to run repeatedly. Leaves every existing feed, article, log, policy,
-- web UI, schedule, and schema untouched.
-- AFP exposes agency press releases at this URL, NOT its licensed global newswire.
-- RSS publishers may restrict feeds to personal/non-commercial use. Respect terms.

with requested(name, feed_url, website_url) as (
  values
    ('The Telegraph',
      'https://www.telegraph.co.uk/rss/',
      'https://www.telegraph.co.uk'),
    ('NDTV',
      'https://feeds.feedburner.com/ndtvnews-latest',
      'https://www.ndtv.com'),
    ('AFP (Press Releases)',
      'https://www.afp.com/en/actus/afp_communique/all/feed',
      'https://www.afp.com/en'),
    ('Hindustan Times',
      'https://www.hindustantimes.com/feeds/rss/latest/rssfeed.xml',
      'https://www.hindustantimes.com'),
    ('The Guardian',
      'https://www.theguardian.com/world/rss',
      'https://www.theguardian.com'),
    ('Fox News',
      'https://moxie.foxnews.com/google-publisher/latest.xml',
      'https://www.foxnews.com')
)
insert into public.feed_sources (name, feed_url, website_url, is_active)
select r.name, r.feed_url, r.website_url, true
from requested r
where not exists (
  select 1 from public.feed_sources f
  where f.name = r.name or f.feed_url = r.feed_url
)
on conflict do nothing;

-- Read-only verification after applying:
select name, feed_url, is_active, last_checked_at, last_success_at, last_error
from public.feed_sources
where name in (
  'The Telegraph', 'NDTV', 'AFP (Press Releases)',
  'Hindustan Times', 'The Guardian', 'Fox News'
)
order by name;
