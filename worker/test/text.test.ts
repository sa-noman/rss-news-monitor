import { describe, expect, it } from 'vitest';
import { collapse, decodeEntities, parseDate, pickImage, slugify, stripBoilerplate, stripHtml, toAbsoluteUrl, truncate } from '../src/text';

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('a &amp; b &#8212; c &#x2014; d')).toBe('a & b — c — d');
    expect(decodeEntities('&hellip; &nbsp;x')).toBe('…  x');
  });
  it('decodes double-encoded feeds', () => {
    expect(decodeEntities('Ben &amp;#8217; s')).toBe('Ben ’ s');
  });
  it('leaves unknown entities untouched', () => {
    expect(decodeEntities('&notarealentity;')).toBe('&notarealentity;');
  });
});

describe('stripHtml', () => {
  it('removes tags, scripts and comments then decodes', () => {
    const html = '<p>Hello <b>world</b></p><script>evil()</script><!--x--> &amp; bye<br/>';
    expect(stripHtml(html)).toBe('Hello world & bye');
  });
});

describe('stripBoilerplate', () => {
  it('cuts "Continue reading" tails and substack footers', () => {
    expect(stripBoilerplate('Real summary here. Continue reading at example.com')).toBe('Real summary here.');
    expect(stripBoilerplate('Body text. The post X appeared first on Y.')).toBe('Body text.');
  });
});

describe('truncate', () => {
  it('never exceeds the limit and ellipsizes on a word boundary', () => {
    const out = truncate('a'.repeat(20) + ' ' + 'b'.repeat(20), 30);
    expect(out.length).toBeLessThanOrEqual(31);
    expect(out.endsWith('…')).toBe(true);
  });
  it('leaves short strings alone', () => {
    expect(truncate('short', 50)).toBe('short');
  });
});

describe('slugify', () => {
  it('handles english', () => {
    expect(slugify("Ceasefire talks: resume & 'hold'")).toBe('ceasefire-talks-resume-hold');
  });
  it('keeps bengali characters', () => {
    const s = slugify('যুদ্ধবিরতি নিয়ে আলোচনা শুরু');
    expect(s).toMatch(/[\u0980-\u09ff]/);
    expect(s).not.toMatch(/[^a-z0-9\u0980-\u09ff-]/);
  });
});

describe('toAbsoluteUrl', () => {
  it('resolves relative urls', () => {
    expect(toAbsoluteUrl('/news/a', 'https://example.org/feed')).toBe('https://example.org/news/a');
  });
  it('rejects javascript:, data: and empty input', () => {
    expect(toAbsoluteUrl('javascript:alert(1)', 'https://example.org')).toBeNull();
    expect(toAbsoluteUrl('data:image/png;base64,AAA', 'https://example.org')).toBeNull();
    expect(toAbsoluteUrl('   ', 'https://example.org')).toBeNull();
  });
});

describe('parseDate', () => {
  const now = Date.parse('2026-10-08T00:00:00Z');
  it('parses RFC-822', () => {
    expect(parseDate('Thu, 08 Oct 2026 06:30:00 +0000', now)).toBe('2026-10-08T06:30:00.000Z');
  });
  it('parses ISO-8601 with offset', () => {
    expect(parseDate('2026-10-07T18:33:00-04:00', now)).toBe('2026-10-07T22:33:00.000Z');
  });
  it('returns null for junk', () => {
    expect(parseDate('not a date at all', now)).toBeNull();
    expect(parseDate(null, now)).toBeNull();
  });
  it('rejects absurd future dates', () => {
    expect(parseDate('Thu, 08 Oct 2037 06:30:00 +0000', now)).toBeNull();
  });
});

describe('pickImage', () => {
  it('prefers image-looking urls and absolutizes', () => {
    expect(pickImage(['/img/a.jpg', 'https://cdn.example.com/page'], 'https://example.org/feed'))
      .toBe('https://example.org/img/a.jpg');
  });
  it('returns null when nothing is usable', () => {
    expect(pickImage([null, undefined, ''], 'https://example.org')).toBeNull();
  });
});

describe('collapse', () => {
  it('normalizes nbsp and newlines', () => {
    expect(collapse('a\u00a0\u00a0b\n c')).toBe('a b c');
  });
});
