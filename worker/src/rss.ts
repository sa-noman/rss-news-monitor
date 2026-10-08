/**
 * Dependency-free RSS 2.0 / Atom 1.0 parser.
 *
 * Why not an XML library? Feeds in the wild are messy (undeclared entities,
 * CDATA, stray HTML, missing namespaces) and a tolerant extractor is more
 * robust than a strict parser that throws on one malformed byte. Any single
 * broken item is skipped instead of failing the whole feed.
 *
 * Performance notes (Cloudflare free plan allows ~10 ms CPU per invocation):
 *  - every tag regex is compiled once and cached,
 *  - parsing stops as soon as `maxItems` stories were collected,
 *  - long description/content fields are sliced before HTML stripping.
 */

import { cleanTitle, collapse, decodeEntities, parseDate, pickImage, slugify, stripBoilerplate, stripHtml, toAbsoluteUrl, truncate } from './text';
import type { ParsedItem } from './types';

export interface ParsedFeed {
  kind: 'rss' | 'atom' | 'unknown';
  feedTitle: string | null;
  items: ParsedItem[];
}

export interface ParseOptions {
  /** Stop after this many items (feeds list newest first, so this is safe). */
  maxItems?: number;
}

const HARD_ITEM_CAP = 200;
const SUMMARY_INPUT_CAP = 800; // raw chars fed into HTML stripping (we keep 400)
const SUMMARY_MAX = 400; // stored summary length

/* ------------------------------------------------------------------ caches */
const textReCache = new Map<string, RegExp>();
const allReCache = new Map<string, RegExp>();

function tagTextRegex(name: string): RegExp {
  let re = textReCache.get(name);
  if (!re) {
    re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i');
    textReCache.set(name, re);
  }
  return re;
}

function tagAllRegex(name: string): RegExp {
  let re = allReCache.get(name);
  if (!re) {
    re = new RegExp(`<${name}\\b([^>]*?)\\/?>`, 'gi');
    allReCache.set(name, re);
  }
  return re;
}

/** Extract the text of the first matching tag (handles CDATA runs). */
function tagText(block: string, names: string[]): string | null {
  for (const name of names) {
    if (!block.includes(`<${name}`)) continue; // cheap miss: skips a regex scan
    const m = tagTextRegex(name).exec(block);
    if (m) {
      const value = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
      if (value) return value;
    }
  }
  return null;
}

/** Extract an attribute from a tag's raw attribute string. */
function tagAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
  const m = re.exec(attrs);
  if (!m) return null;
  const value = m[1] ?? m[2] ?? m[3] ?? '';
  return value ? decodeEntities(value).trim() : null;
}

/** All occurrences of a tag, as raw attribute strings (max 40). */
function tagAttrsAll(block: string, name: string): string[] {
  if (!block.includes(`<${name}`)) return [];
  const re = tagAllRegex(name);
  re.lastIndex = 0;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    out.push(m[1] ?? '');
    if (out.length > 40) break;
  }
  return out;
}

/** RSS <link>text</link>, or Atom <link href="…" rel="alternate">. */
function itemLink(block: string, isAtom: boolean, base: string): string | null {
  if (isAtom) {
    const candidates = tagAttrsAll(block, 'link').map((attrs) => ({
      href: tagAttr(attrs, 'href'),
      rel: (tagAttr(attrs, 'rel') ?? 'alternate').toLowerCase(),
      type: (tagAttr(attrs, 'type') ?? '').toLowerCase(),
    }));
    const best =
      candidates.find((c) => c.rel === 'alternate' && c.type.includes('html')) ??
      candidates.find((c) => c.rel === 'alternate' && !c.type) ??
      candidates.find((c) => c.rel === 'alternate') ??
      candidates[0];
    return best?.href ? toAbsoluteUrl(best.href, base) : null;
  }
  const direct = tagText(block, ['link']);
  if (direct) {
    const abs = toAbsoluteUrl(direct.replace(/^<!\[CDATA\[|\]\]>$/g, ''), base);
    if (abs) return abs;
  }
  // fall back to <guid> only when it claims to be a permalink (or has no flag)
  const guidAttrs = tagAttrsAll(block, 'guid')[0];
  const guidText = tagText(block, ['guid']);
  const permaOk = guidAttrs === '' || guidAttrs === undefined || tagAttr(guidAttrs, 'isPermaLink') !== 'false';
  if (guidText && permaOk && /^https?:\/\//i.test(guidText.trim())) {
    return toAbsoluteUrl(guidText, base);
  }
  return null;
}

/** Best-effort image discovery, in descending order of trust. */
function itemImage(block: string, base: string, descriptionHtml: string | null): string | null {
  const candidates: Array<string | null> = [];

  for (const attrs of tagAttrsAll(block, 'media:thumbnail')) candidates.push(tagAttr(attrs, 'url'));
  for (const attrs of tagAttrsAll(block, 'media:content')) {
    const type = (tagAttr(attrs, 'type') ?? '').toLowerCase();
    const medium = (tagAttr(attrs, 'medium') ?? '').toLowerCase();
    const url = tagAttr(attrs, 'url');
    if (!type || type.startsWith('image/') || medium === 'image') candidates.push(url);
    else candidates.push(/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url ?? '') ? url : null);
  }
  for (const attrs of tagAttrsAll(block, 'enclosure')) {
    const type = (tagAttr(attrs, 'type') ?? '').toLowerCase();
    if (!type || type.startsWith('image/')) candidates.push(tagAttr(attrs, 'url'));
  }
  for (const attrs of tagAttrsAll(block, 'itunes:image')) candidates.push(tagAttr(attrs, 'href'));
  for (const attrs of tagAttrsAll(block, 'image')) candidates.push(tagAttr(attrs, 'href') ?? tagAttr(attrs, 'url'));

  if (descriptionHtml) {
    const imgRe = /<img\b([^>]*)>/gi;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = imgRe.exec(descriptionHtml)) !== null && count < 6) {
      count++;
      const src = tagAttr(m[1], 'src') ?? tagAttr(m[1], 'data-src');
      const width = parseInt(tagAttr(m[1], 'width') ?? '0', 10);
      if (src && !(width > 0 && width <= 2)) candidates.push(src); // skip tracking pixels
    }
  }
  return pickImage(candidates, base);
}

function itemSummary(block: string, isAtom: boolean): string | null {
  // Preferred: the short summary/description fields only — never full-article
  // fields such as content:encoded, unless nothing else exists (then truncated).
  const primary = isAtom
    ? tagText(block, ['summary', 'description'])
    : tagText(block, ['description', 'summary']);
  if (primary) {
    const cleaned = stripBoilerplate(stripHtml(primary.slice(0, SUMMARY_INPUT_CAP)));
    if (cleaned) return truncate(cleaned, SUMMARY_MAX);
  }

  const fallbackRaw = isAtom ? tagText(block, ['content']) : tagText(block, ['content:encoded']);
  if (!fallbackRaw) return null;
  const fallback = stripBoilerplate(stripHtml(fallbackRaw.slice(0, SUMMARY_INPUT_CAP)));
  return fallback ? truncate(fallback, SUMMARY_MAX) : null;
}

function itemAuthor(block: string, isAtom: boolean): string | null {
  if (isAtom) {
    const authorBlock = tagText(block, ['author']);
    if (authorBlock) {
      const name = tagText(authorBlock, ['name']);
      if (name) return collapse(stripHtml(name)).slice(0, 120) || null;
    }
    const direct = tagText(block, ['dc:creator', 'creator']);
    if (direct) return collapse(stripHtml(direct)).slice(0, 120) || null;
    return null;
  }
  const direct = tagText(block, ['dc:creator', 'author', 'creator']);
  if (!direct) return null;
  const name = collapse(stripHtml(direct)).replace(/^([^<]*)<[^>]*>$/, '$1');
  return name.slice(0, 120) || null;
}

function itemPublished(block: string, isAtom: boolean): string | null {
  const order = isAtom
    ? ['published', 'updated', 'pubDate', 'dc:date', 'date']
    : ['pubDate', 'published', 'dc:date', 'updated', 'date'];
  for (const name of order) {
    const parsed = parseDate(tagText(block, [name]));
    if (parsed) return parsed;
  }
  return null;
}

function extractFeedCategories(block: string, isAtom: boolean): string[] {
  const out: string[] = [];
  const re = isAtom
    ? /<category\b([^>]*)\/?>/gi
    : /<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null && out.length < 6) {
    const value = isAtom
      ? tagAttr(m[1] ?? '', 'term') ?? tagAttr(m[1] ?? '', 'label')
      : collapse(stripHtml(m[1] ?? ''));
    if (value) out.push(collapse(decodeEntities(value)));
  }
  return out;
}

/**
 * Parse an RSS or Atom document into normalized items.
 * @param xml      raw feed body (already size-capped by the caller)
 * @param feedUrl  URL the feed was fetched from (used to absolutize links)
 * @param options  maxItems = stop early once enough stories were collected
 */
export function parseFeed(xml: string, feedUrl: string, options: ParseOptions = {}): ParsedFeed {
  const maxItems = Math.max(1, Math.min(HARD_ITEM_CAP, options.maxItems ?? 40));

  // Detect the feed type from the first 2 KB instead of scanning the whole body
  // (a 400 KB scan is pure CPU waste inside a 10 ms budget).
  const head = xml.slice(0, 4_096);
  const kind: ParsedFeed['kind'] = /<feed[\s>]/i.test(head)
    ? 'atom'
    : /<rss[\s>]/i.test(head)
      ? 'rss'
      : /<entry[\s>]/i.test(xml.slice(0, 2_048))
        ? 'atom'
        : /<item[\s>]/i.test(xml.slice(0, 2_048))
          ? 'rss'
          : 'unknown';

  const headBlockMatch = /<(channel|feed)[\s>][\s\S]*?<\/\1>/i.exec(head);
  const headBlock = headBlockMatch?.[0] ?? head;
  const feedTitle = (() => {
    const raw = tagText(headBlock, ['title']);
    return raw ? cleanTitle(raw) || null : null;
  })();

  const blockRe = new RegExp(
    kind === 'atom' ? '<entry(?:\\s[^>]*)?>([\\s\\S]*?)</entry>' : '<item(?:\\s[^>]*)?>([\\s\\S]*?)</item>',
    'gi',
  );

  const items: ParsedItem[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(xml)) !== null) {
    if (items.length >= maxItems) break; // early exit: newest items come first
    try {
      const block = match[1];
      const title = cleanTitle(tagText(block, ['title']) ?? '');
      if (!title) continue;

      const link = itemLink(block, kind === 'atom', feedUrl);
      if (!link || seen.has(link)) continue;
      seen.add(link);

      const descriptionHtml = tagText(
        block,
        kind === 'atom' ? ['summary', 'description', 'content'] : ['description', 'summary', 'content:encoded'],
      );

      items.push({
        title,
        link,
        slug: slugify(title) || null,
        summary: itemSummary(block, kind === 'atom'),
        image_url: itemImage(block, feedUrl, descriptionHtml ? descriptionHtml.slice(0, SUMMARY_INPUT_CAP) : null),
        author: itemAuthor(block, kind === 'atom'),
        published_at: itemPublished(block, kind === 'atom'),
        raw_categories: extractFeedCategories(block, kind === 'atom'),
      });
    } catch {
      continue; // one malformed item must never break the feed
    }
  }

  return { kind, feedTitle, items };
}
