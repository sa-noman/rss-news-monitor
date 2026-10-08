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
  return null;
}
