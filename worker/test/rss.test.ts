import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFeed } from '../src/rss';
import type { ParsedItem } from '../src/types';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

/** Invariants every item from every feed must satisfy (the contract with the DB). */
function assertInvariants(items: ParsedItem[], label: string): void {
  for (const item of items) {
    expect(item.title.length, `${label}: title`).toBeGreaterThan(0);
    expect(item.link, `${label}: link`).toMatch(/^https?:\/\//);
    expect(item.title.length, `${label}: title length`).toBeLessThanOrEqual(500);
    if (item.summary !== null) {
      expect(item.summary.length, `${label}: summary length`).toBeLessThanOrEqual(401);
      expect(item.summary, `${label}: no html left`).not.toMatch(/<[a-z/][^>]*>/i);
      expect(item.summary.trim().length, `${label}: summary not blank`).toBeGreaterThan(0);
    }
    if (item.published_at !== null) {
      expect(item.published_at, `${label}: date is ISO`).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
    if (item.image_url !== null) {
      expect(item.image_url, `${label}: image absolute`).toMatch(/^https?:\/\//);
    }
  }
}

const REAL_FEEDS: Array<[string, 'rss' | 'atom', string]> = [
  ['aljazeera.xml', 'rss', 'https://www.aljazeera.com/xml/rss/all.xml'],
  ['atlantic.xml', 'atom', 'https://www.theatlantic.com/feed/all/'],
  ['nytimes.xml', 'rss', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml'],
  ['dailysabah.xml', 'rss', 'https://www.dailysabah.com/rssFeed/rss.xml'],
  ['dropsite.xml', 'rss', 'https://dropsitenews.substack.com/feed'],
  ['axios.xml', 'rss', 'https://api.axios.com/feed/'],
  ['economist.xml', 'rss', 'https://www.economist.com/the-world-this-week/rss.xml'],
  ['ft.xml', 'rss', 'https://www.ft.com/rss/home'],
  ['aa-live.xml', 'rss', 'https://www.aa.com.tr/en/rss/default?cat=live'],
  ['wsj-dowjones.xml', 'rss', 'https://feeds.content.dowjones.io/public/rss/RSSWorldNews'],
  ['haaretz-world.xml', 'rss', 'https://www.haaretz.com/srv/world-news-rss'],
  ['politico-politics.xml', 'rss', 'https://rss.politico.com/politics-news.xml'],
];

describe('parseFeed — real captured feeds', () => {
  for (const [file, kind, url] of REAL_FEEDS) {
    it(`${file} parses with valid items`, () => {
      const parsed = parseFeed(fixture(file), url);
      expect(parsed.kind).toBe(kind);
      expect(parsed.items.length).toBeGreaterThan(0);
      assertInvariants(parsed.items, file);
    });
  }

  it('atlantic (Atom) keeps the short summary, not the full newsletter text', () => {
    const parsed = parseFeed(fixture('atlantic.xml'), 'https://www.theatlantic.com/feed/all/');
    const first = parsed.items[0];
    expect(first.link).toContain('https://www.theatlantic.com/');
    expect(first.summary).toBeTruthy();
    expect(first.summary!.length).toBeLessThan(300);
    expect(first.summary!.toLowerCase()).not.toContain('this is an edition of');
  });

  it('dropsite (Substack, long content:encoded) is truncated to a summary', () => {
    const parsed = parseFeed(fixture('dropsite.xml'), 'https://dropsitenews.substack.com/feed');
    for (const item of parsed.items) {
      expect(item.summary ? item.summary.length : 0).toBeLessThanOrEqual(401);
    }
  });

  it('daily sabah keeps its media:content / enclosure image', () => {
    const parsed = parseFeed(fixture('dailysabah.xml'), 'https://www.dailysabah.com/rssFeed/rss.xml');
    expect(parsed.items.some((i) => Boolean(i.image_url))).toBe(true);
  });

  it('politico deduplicates repeated links inside one feed', () => {
    const parsed = parseFeed(fixture('politico-politics.xml'), 'https://rss.politico.com/politics-news.xml');
    const links = parsed.items.map((i) => i.link);
    expect(new Set(links).size).toBe(links.length);
  });
});

describe('parseFeed — synthetic edge cases', () => {
  it('RSS: CDATA, entities, relative links, invalid dates, missing link', () => {
    const parsed = parseFeed(fixture('synthetic-rss.xml'), 'https://example.org/feed.xml');
    expect(parsed.kind).toBe('rss');
    expect(parsed.feedTitle).toBe('Synthetic Test Feed & Friends');
    expect(parsed.items).toHaveLength(3); // item without a link is skipped

    const [a, b, c] = parsed.items;
    expect(a.title).toBe('Ceasefire talks resume as & delegates meet');
    expect(a.link).toBe('https://example.org/news/ceasefire-talks');
    expect(a.summary).toBe('Delegates met in Geneva — talks continue — sources say.');
    expect(a.image_url).toBe('https://example.org/img/geneva.jpg');
    expect(a.author).toBe('Jane Reporter');
    expect(a.published_at).toBe('2026-10-08T06:30:00.000Z');
    expect(a.slug).toBe('ceasefire-talks-resume-as-delegates-meet');

    expect(b.title).toBe('Election results & the road ahead');
    expect(b.published_at).toBeNull(); // "not a date at all"
    expect(b.summary).not.toMatch(/continue reading/i);

    expect(c.image_url).toBe('https://example.org/media/chart.png'); // from <enclosure>
  });

  it('Atom: prefers rel=alternate link and <summary> over <content>', () => {
    const parsed = parseFeed(fixture('synthetic-atom.xml'), 'https://example.com/feed.xml');
    expect(parsed.kind).toBe('atom');
    expect(parsed.items).toHaveLength(2);

    const first = parsed.items[0];
    expect(first.link).toBe('https://example.com/newsletters/2026/10/bond-market/?utm_source=feed');
    expect(first.author).toBe('Will Gottsegen');
    expect(first.image_url).toBe('https://cdn.example.com/media/2026/10/hero/original.jpg');
    expect(first.published_at).toBe('2026-10-07T22:33:00.000Z');
    expect(first.summary).toBe('The Treasury secretary is projecting confidence while struggling to get borrowing costs down.');

    const second = parsed.items[1];
    expect(second.published_at).toBe('2026-10-08T01:15:00.000Z'); // falls back to <updated>
    expect(second.summary).toBe('A short summary.'); // substack footer stripped
    expect(second.image_url).toBeNull();
  });

  it('detects a non-feed document instead of throwing', () => {
    const parsed = parseFeed(fixture('synthetic-broken.xml'), 'https://example.org/feed.xml');
    expect(parsed.kind).toBe('unknown');
    expect(parsed.items).toHaveLength(0);
  });

  it('never throws on garbage input', () => {
    for (const junk of ['', '<rss>', '<html><body>404</body></html>', '<item><title>a</title>']) {
      expect(() => parseFeed(junk, 'https://example.org')).not.toThrow();
    }
  });
});
