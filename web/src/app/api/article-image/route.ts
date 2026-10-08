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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3200);
    try {
      const response = await fetch(data.link, {
        signal:controller.signal,
        redirect:'manual',
        headers: {'Accept':'text/html','User-Agent':'Mozilla/5.0 (compatible; NewsMonitor/1.0)'},
        next:{revalidate:3600}
      });
      if (!response.ok || !(response.headers.get('content-type')??'').includes('text/html')) {
        return NextResponse.json({image:null});
      }
      const img = articleImageFromHtml(await htmlHead(response),data.link);
      return NextResponse.json({image:img},{headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=1800'}});
    } finally { clearTimeout(timer); }
  } catch {
    return NextResponse.json({image:null});
  }
}
