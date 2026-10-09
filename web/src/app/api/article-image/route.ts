import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import { articleImageFromHtml } from '@/lib/article-image';

export const dynamic = 'force-dynamic';

// Restrict outbound requests to established monitored publishers, never user-submitted URLs.
const TRUSTED_HOSTS = [
  'aljazeera.com','aa.com.tr','axios.com','dailysabah.com',
  'dropsitenews.com','ft.com','foreignaffairs.com','haaretz.com',
  'middleeasteye.net','politico.com','rfi.fr','theatlantic.com',
  'thediplomat.com','economist.com','nytimes.com','wsj.com',
  'washingtonpost.com','substack.com',
];
function trusted(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') &&
      TRUSTED_HOSTS.some(domain => host === domain || host.endsWith('.' + domain));
  } catch { return false; }
}

/** Anadolu provides lead images in RSS <item><image>URL</image>, not media tags. */
async function anadoluFeedImage(articleUrl: string): Promise<string | null> {
  const feed = 'https://www.aa.com.tr/en/rss/default?cat=live';
  try {
    const response = await fetch(feed, { signal: AbortSignal.timeout(4500), cache: 'no-store' });
    if (!response.ok) return null;
    const xml = (await response.text()).slice(0, 500_000);
    const articleId = new URL(articleUrl).pathname.match(/\/(\d+)\/?$/)?.[1];
    if (!articleId) return null;
    const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
    for (const item of items) {
      const link = item.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i)?.[1] ?? '';
      const guid = item.match(/<guid(?:\s[^>]*)?>([\s\S]*?)<\/guid>/i)?.[1] ?? '';
      if (![link,guid].some(s => new RegExp('/' + articleId + '(?:/|\\s|$|<|\\?)').test(s))) continue;
      const raw = item.match(/<image(?:\s[^>]*)?>([\s\S]*?)<\/image>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g,'').trim();
      if (!raw) return null;
      const url = new URL(raw.replace(/&amp;/g,'&'),feed);
      if (url.protocol !== 'https:' || !/^(?:[\w-]+\.)*aa\.com\.tr$/.test(url.hostname)) return null;
      return url.toString();
    }
  } catch { /* feed unavailable */ }
  return null;
}

/** Match only a real Economist article in a feed; never reuse a section image. */
async function economistFeedImage(articleUrl: string): Promise<string | null> {
  const feeds = [
    'https://www.economist.com/the-world-this-week/rss.xml',
    'https://www.economist.com/business/rss.xml',
    'https://www.economist.com/international/rss.xml',
    'https://www.economist.com/united-states/rss.xml',
    'https://www.economist.com/finance-and-economics/rss.xml',
  ];
  const target = new URL(articleUrl).pathname.replace(/\/+$/, '');
  if (target.split('/').filter(Boolean).length < 3) return null; // section pages have no article hero
  for (const feed of feeds) {
    try {
      const res = await fetch(feed, { signal: AbortSignal.timeout(2300), next: { revalidate: 300 } });
      if (!res.ok) continue;
      const xml = (await res.text()).slice(0, 450_000);
      for (const item of xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []) {
        const rawLink = item.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i)?.[1]?.trim();
        if (!rawLink) continue;
        let isSame = false;
        try {
          const link = new URL(rawLink.replace(/&amp;/gi, '&'));
          isSame = link.pathname.replace(/\/+$/, '') === target;
        } catch { /* invalid URL */ }
        if (!isSame) continue;
        for (const tag of item.matchAll(/<(?:media:content|media:thumbnail|enclosure)\b([^>]*?)\/?>/gi)) {
          const attrs = tag[1] ?? '';
          const type = attrs.match(/\btype=["']([^"']+)["']/i)?.[1];
          if (type && !type.startsWith('image/')) continue;
          const raw = attrs.match(/\burl=["']([^"']+)["']/i)?.[1];
          if (!raw) continue;
          const image = new URL(raw.replace(/&amp;/gi, '&'), feed);
          if (image.protocol === 'https:' && !/(?:logo|icon|avatar|placeholder)/i.test(image.pathname)) return image.toString();
        }
      }
    } catch { /* feed unavailable */ }
  }
  return null;
}

/**
 * Manual rights-reviewed Washington Post artwork only. This JSON configuration
 * is deliberately empty by default. Never equate an accessible RSS/OG URL with
 * permission to display a full-size photograph.
 *
 * WP_APPROVED_IMAGES_JSON:
 * {"https://www.washingtonpost.com/...": {
 *   "url":"https://licensed-cdn.example.com/photo.jpg",
 *   "permission":"licensed", "credit":"Photographer / Licensor",
 *   "evidence":"License record or approval reference"
 * }}
 */
function approvedWashingtonPostImage(articleUrl: string): string | null {
  const raw = process.env.WP_APPROVED_IMAGES_JSON;
  if (!raw || raw.length > 200_000) return null;
  try {
    const config = JSON.parse(raw) as Record<string, {
      url?: string; permission?: string; credit?: string; evidence?: string;
    }>;
    const normalize = (value: string) => {
      const u = new URL(value);
      return u.origin + u.pathname.replace(/\/+$/, '');
    };
    const entry = Object.entries(config).find(([key]) => {
      try { return normalize(key) === normalize(articleUrl); } catch { return false; }
    })?.[1];
    if (!entry || entry.permission !== 'licensed' || !entry.credit?.trim() || !entry.evidence?.trim()) return null;
    const img = new URL(entry.url ?? '');
    if (img.protocol !== 'https:' || img.username || img.password || img.port) return null;
    return img.toString();
  } catch { return null; }
}

async function htmlHead(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let html = '';
  try {
    while (html.length < 140_000) {
      const next = await reader.read();
      if (next.done) break;
      html += decoder.decode(next.value, { stream: true });
      if (/<\/head\s*>/i.test(html)) break;
    }
  } finally { await reader.cancel().catch(() => {}); }
  return html.slice(0, 140_000);
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({image:null},{status:400});
  const supabase = getServerClient();
  if (!supabase) return NextResponse.json({image:null});
  try {
    const {data,error} = await supabase.from('news').select('link,image_url').eq('id',id).maybeSingle();
    if (error || !data) return NextResponse.json({image:null});
    if (!trusted(data.link)) return NextResponse.json({image:null});
    // Post photos are rights-managed. Only serve individually approved artwork;
    // RSS, stored image_url and freely reachable OG URLs are not licenses.
    if (new URL(data.link).hostname.endsWith('washingtonpost.com')) {
      const image = approvedWashingtonPostImage(data.link);
      return NextResponse.json({ image }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (data.image_url) return NextResponse.json({image:data.image_url});
    const isAnadolu = new URL(data.link).hostname.endsWith('aa.com.tr');
    if (isAnadolu) {
      const rssImage = await anadoluFeedImage(data.link);
      if (rssImage) return NextResponse.json({ image:rssImage }, { headers:{ 'Cache-Control':'public, s-maxage=300' } });
    }
    if (new URL(data.link).hostname.endsWith('economist.com')) {
      const rssImage = await economistFeedImage(data.link);
      if (rssImage) return NextResponse.json({ image: rssImage }, { headers: { 'Cache-Control': 'public, s-maxage=300' } });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), isAnadolu ? 6500 : 3200);
    try {
      const response = await fetch(data.link, {
        signal:controller.signal,
        redirect:'follow',
        headers: {'Accept':'text/html,application/xhtml+xml','Accept-Language':'en-US,en;q=0.9','User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'},
        ...(isAnadolu ? { cache:'no-store' as const } : { next:{revalidate:3600} })
      });
      if (!response.ok || ((response.headers.get('content-type')??'').length > 0 && !(response.headers.get('content-type')??'').includes('text/html'))) {
        return NextResponse.json({image:null});
      }
      if (!trusted(response.url || data.link)) return NextResponse.json({image:null});
      const html = await htmlHead(response);
      const img = articleImageFromHtml(html, response.url || data.link);
      return NextResponse.json({image:img},{headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=1800'}});
    } finally { clearTimeout(timer); }
  } catch {
    return NextResponse.json({image:null});
  }
}
