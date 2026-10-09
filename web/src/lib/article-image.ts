/** Extract real article preview image URLs from publisher metadata. */
export function articleImageFromHtml(html: string, base: string): string | null {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const attr = (tag: string, key: string): string | null => {
    const re = /([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(tag)) !== null) {
      if (match[1].toLowerCase() === key) return (match[2] ?? match[3]).replace(/&amp;/gi, '&');
    }
    return null;
  };
  for (const name of ['og:image:secure_url','og:image','twitter:image','twitter:image:src']) {
    for (const tag of metas) {
      if ((attr(tag,'property') ?? attr(tag,'name') ?? '').toLowerCase() !== name) continue;
      const raw = attr(tag,'content');
      if (!raw) continue;
      try {
        const parsed = new URL(raw,base);
        if (!['https:','http:'].includes(parsed.protocol)) continue;
        if (/\.(svg)(?:[?#]|$)/i.test(parsed.pathname) || /(?:logo|favicon|icon|placeholder|avatar)/i.test(parsed.pathname)) continue;
        return parsed.toString();
      } catch { /* invalid URL */ }
    }
  }
  // Some publishers use NewsArticle JSON-LD for the original lead image.
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const imageValue = (v: unknown): string | null => {
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(imageValue).find(Boolean) ?? null;
    if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      return imageValue(obj.url) || imageValue(obj.contentUrl);
    }
    return null;
  };
  const locate = (v: unknown): string | null => {
    if (Array.isArray(v)) return v.map(locate).find(Boolean) ?? null;
    if (!v || typeof v !== 'object') return null;
    const obj = v as Record<string, unknown>;
    const kind = String(obj['@type'] ?? '').toLowerCase();
    if (kind.includes('article')) {
      const img = imageValue(obj.image) || imageValue(obj.thumbnailUrl);
      if (img) return img;
    }
    for (const child of Object.values(obj)) {
      if (child && typeof child === 'object') {
        const result = locate(child);
        if (result) return result;
      }
    }
    return null;
  };
  for (const block of blocks.slice(0, 8)) {
    try {
      const match = locate(JSON.parse(block[1]));
      if (!match) continue;
      const url = new URL(match, base);
      if (['https:', 'http:'].includes(url.protocol) && !/(?:logo|favicon|icon|placeholder|avatar)/i.test(url.pathname)) return url.toString();
    } catch { /* unparseable publisher metadata */ }
  }
  return null;
}
