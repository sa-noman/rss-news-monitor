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
    if (data.image_url) return NextResponse.json({image:data.image_url});
    if (!trusted(data.link)) return NextResponse.json({image:null});
    const isAnadolu = new URL(data.link).hostname.endsWith('aa.com.tr');
    if (isAnadolu) {
      const rssImage = await anadoluFeedImage(data.link);
      if (rssImage) return NextResponse.json({ image:rssImage }, { headers:{ 'Cache-Control':'public, s-maxage=300' } });
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
