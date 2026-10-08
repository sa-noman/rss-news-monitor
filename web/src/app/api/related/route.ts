import { NextRequest, NextResponse } from 'next/server';
import { demoNews } from '@/lib/demo-data';
import { getServerClient } from '@/lib/supabase';
import type { NewsItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STOP = new Set('the and for with from that this after amid over about says said into will have has are was were new news more than their its his her at in on of to a an as by or is us uk'.split(' '));
function normalized(title: string) {
  return title.toLocaleLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function terms(title: string) {
  return new Set(normalized(title).split(' ').filter(word => word.length >= 4 && !STOP.has(word)));
}
function related(article: NewsItem, candidates: NewsItem[]) {
  const base = terms(article.title);
  return candidates.filter(other => {
    if (other.id === article.id || other.source_name === article.source_name) return false;
    const a = Date.parse(article.published_at ?? article.created_at);
    const b = Date.parse(other.published_at ?? other.created_at);
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a-b) > 72*3600000) return false;
    if (normalized(article.title) === normalized(other.title)) return true;
    const compared = terms(other.title);
    const common = [...base].filter(w => compared.has(w)).length;
    return common >= 4 && common / Math.max(1, new Set([...base, ...compared]).size) >= .55;
  }).sort((a,b) => Date.parse(b.published_at ?? b.created_at)-Date.parse(a.published_at ?? a.created_at)).slice(0,12);
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id || id.length > 100) return NextResponse.json({ error:'Invalid article id' }, { status:400 });
  const db = getServerClient();
  if (!db) {
    const rows = demoNews();
    const main = rows.find(row => row.id === id);
    return NextResponse.json({ related: main ? related(main,rows) : [], mode:'demo' }, { headers:{'Cache-Control':'no-store'} });
  }
  try {
    const {data:main,error:mainError}=await db.from('news').select('*').eq('id',id).maybeSingle();
    if(mainError) throw mainError;
    if(!main) return NextResponse.json({related:[],mode:'live'},{status:404});
    const row=main as NewsItem;
    const published=Date.parse(row.published_at ?? row.created_at);
    if(!Number.isFinite(published)) return NextResponse.json({related:[],mode:'live'});
    const start=new Date(published-72*3600000).toISOString();
    const end=new Date(published+72*3600000).toISOString();
    const {data,error}=await db.from('news').select('*').gte('published_at',start).lte('published_at',end).neq('source_name',row.source_name).order('published_at',{ascending:false}).limit(500);
    if(error) throw error;
    return NextResponse.json({related:related(row,(data ?? []) as NewsItem[]),mode:'live',scanned:(data ?? []).length},{headers:{'Cache-Control':'private, max-age=60'}});
  } catch {
    return NextResponse.json({error:'Related news lookup unavailable'}, {status:503});
  }
}
