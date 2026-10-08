/**
 * Text helpers shared by the RSS parser and the classifier.
 * Pure functions only — no platform APIs, so they run in Cloudflare Workers,
 * Node (tests / local dry-run) and anywhere else.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '',
  hellip: '…', mdash: '—', ndash: '–', minus: '−', copy: '©', reg: '®', trade: '™',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', sbquo: '‚', bdquo: '„',
  laquo: '«', raquo: '»', lsaquo: '‹', rsaquo: '›', middot: '·', bull: '•',
  deg: '°', plusmn: '±', times: '×', divide: '÷', micro: 'µ', para: '¶', sect: '§',
  dagger: '†', Dagger: '‡', prime: '′', Prime: '″', permil: '‰', frac12: '½',
  frac14: '¼', frac34: '¾', sup2: '²', sup3: '³', sup1: '¹', numero: '№',
  euro: '€', pound: '£', yen: '¥', cent: '¢', curren: '¤',
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', aelig: 'æ', ccedil: 'ç',
  egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë', igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï',
  ntilde: 'ñ', ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö', oslash: 'ø',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', yacute: 'ý', yuml: 'ÿ', szlig: 'ß',
  Agrave: 'À', Aacute: 'Á', Auml: 'Ä', Ccedil: 'Ç', Egrave: 'È', Eacute: 'É', Ouml: 'Ö', Uuml: 'Ü',
};

function fromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** Decode HTML entities, tolerating double-encoded feeds (&amp;#8217;). */
export function decodeEntities(input: string): string {
  let out = input;
  for (let pass = 0; pass < 3; pass++) {
    const next = out
      .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_m, dec: string) => fromCodePoint(parseInt(dec, 10)))
      .replace(/&([a-z][a-z0-9]{1,10});/gi, (m, name: string) => NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? m);
    if (next === out) break;
    out = next;
    if (!/&(#?[a-z0-9]+);/i.test(out)) break;
  }
  return out;
}

/** Collapse all whitespace runs (incl. NBSP) into single spaces and trim. */
export function collapse(input: string): string {
  return input.replace(/[\s\u00a0\u200b]+/g, ' ').trim();
}

/**
 * Remove tags/scripts/comments and decode entities.
 * Entities are decoded *first* on purpose: many feeds (e.g. Axios) ship escaped
 * HTML ("&lt;p&gt;…") which would otherwise turn into real tags after decoding.
 */
export function stripHtml(input: string): string {
  let s = decodeEntities(input);
  // fast path: plain text (very common in RSS descriptions) needs no tag work
  if (s.indexOf('<') === -1) return collapse(s);
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<br\s*\/?>/gi, ' ');
  s = s.replace(/<\/(p|div|li|h[1-6]|tr|td)>/gi, ' ');
  s = s.replace(/<[^>]*>/g, ' ');
  s = decodeEntities(s); // decoding may have surfaced more entities
  return collapse(s);
}

/** Strip feed boilerplate noise that would pollute our short summaries. */
export function stripBoilerplate(input: string): string {
  return collapse(
    input
      .replace(/\[\s*(?:…|\.\.\.|&#8230;)\s*\]/g, ' ')
      .replace(/\s*(?:continue reading|read more|read the full (?:story|article)|full story|আরও পড়ুন|বিস্তারিত পড়ুন)[\s:»›-]*[\s\S]*$/i, ' ')
      .replace(/\s*the post .{0,160}? appeared first on .{0,80}?\.?\s*$/i, ' ')
      .replace(/\s*(?:subscribe|sign up) (?:now|today|to .{0,60}?)\.?\s*$/i, ' '),
  );
}

export function cleanTitle(input: string): string {
  const t = stripHtml(input);
  return collapse(t.replace(/^[\s\-–—|:•]+/, '').replace(/[\s\-–—|:•]+$/, ''));
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  const slice = input.slice(0, max);
  const cut = slice.lastIndexOf(' ');
  const body = (cut > max * 0.6 ? slice.slice(0, cut) : slice).replace(/[\s,;:.\-–—]+$/, '');
  return `${body}…`;
}

/** Build a URL-safe slug. Keeps Bengali characters (U+0980–U+09FF). */
export function slugify(input: string, max = 80): string {
  // fast path: pure ASCII titles (the overwhelming majority) skip NFKD
  if (/^[\x20-\x7e]*$/.test(input)) {
    return input
      .toLowerCase()
      .replace(/['"`]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max)
      .replace(/-+$/g, '');
  }
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['"’‘“”`]/g, '')
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

/** Resolve a possibly-relative URL against a base; returns null when unusable. */
export function toAbsoluteUrl(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  const raw = decodeEntities(href).trim().replace(/^[\s"']+|[\s"']+$/g, '');
  if (!raw || raw.startsWith('data:') || raw.startsWith('javascript:') || raw.startsWith('#')) return null;
  // fast path: already absolute and clean -> skip the URL() constructor
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    if (!/[\s<>"]/.test(raw)) return raw.split('#')[0];
  }
  try {
    const url = new URL(raw, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    // drop tracking fragment noise
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** Parse any RFC-822 / ISO-8601 date string into an ISO timestamp (or null). */
export function parseDate(input: string | null | undefined, now = Date.now()): string | null {
  if (!input) return null;
  const raw = decodeEntities(input).trim();
  if (!raw) return null;
  let t = Date.parse(raw);
  if (Number.isNaN(t)) {
    // a couple of common malformed shapes: "2026-10-08 06:30:00" is fine, but
    // "Thu, 08 Oct 2026 10:10:39" without a zone is not — retry as UTC.
    t = Date.parse(`${raw} GMT`);
  }
  if (Number.isNaN(t)) return null;
  // guard against obviously wrong dates (some feeds carry far-future placeholders)
  if (t > now + 7 * 24 * 60 * 60 * 1000) return null;
  if (t < Date.parse('1995-01-01T00:00:00Z')) return null;
  return new Date(t).toISOString();
}

/** Pick the best-looking image URL out of a list of candidates. */
export function pickImage(candidates: Array<string | null | undefined>, base: string): string | null {
  const cleaned = candidates
    .map((c) => toAbsoluteUrl(c, base))
    .filter((c): c is string => Boolean(c));
  if (cleaned.length === 0) return null;
  const looksLikeImage = (u: string) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u) || u.includes('image');
  return cleaned.find(looksLikeImage) ?? cleaned[0];
}
