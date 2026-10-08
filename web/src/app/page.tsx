import Link from 'next/link';
import { CategoryChips } from '@/components/CategoryChips';
import { DateFilter } from '@/components/DateFilter';
import { ModeBanner } from '@/components/ModeBanner';
import { NewsDashboard } from '@/components/NewsDashboard';
import { Pagination } from '@/components/Pagination';
import { fetchCategoryStats, fetchNews, fetchSources, NEWS_PAGE_SIZE } from '@/lib/data';
import { t, UI_LANG } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type FilterQuery = { category?: string; source?: string; q?: string; date?: string; from?: string; to?: string };

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

function buildHref(query: FilterQuery): string {
  const params = new URLSearchParams();
  if (query.category && query.category !== 'All') params.set('category', query.category);
  if (query.source) params.set('source', query.source);
  if (query.q) params.set('q', query.q);
  if (query.date && query.date !== 'all') params.set('date', query.date);
  if (query.date === 'custom') {
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
  }
  const qs = params.toString();
  return qs ? '/?' + qs : '/';
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const dict = t();
  const bn = UI_LANG === 'bn';
  const category = first(sp.category) ?? 'All';
  const source = first(sp.source);
  const q = first(sp.q);
  const date = first(sp.date);
  const from = first(sp.from);
  const to = first(sp.to);
  const page = Math.min(500, Math.max(1, Number.parseInt(first(sp.page) ?? '1', 10) || 1));

  const [news, stats, sourcesResult] = await Promise.all([
    fetchNews({ category, source, q, date, from, to, page }),
    fetchCategoryStats(),
    fetchSources(),
  ]);

  const { items, total, mode, error } = news;
  const totalPages = Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE));
  const filtering = Boolean((category && category !== 'All') || source || q || (date && date !== 'all'));
  const activeSources = sourcesResult.sources.filter((s) => s.is_active);
  const sourceOptions = [...new Set([...activeSources.map((s) => s.name), ...items.map((i) => i.source_name)])].sort();
  const filters = { category, source, q, date, from, to };

  return (
    <div className="monitor-home">
      {mode === 'demo' ? <ModeBanner error={error} /> : null}

      <div className="monitor-page-intro">
        <div>
          <span className="monitor-eyebrow">{bn ? 'আন্তর্জাতিক সংবাদ পর্যবেক্ষণ' : 'GLOBAL NEWS MONITORING'}</span>
          <h1 className="headline">{bn ? 'আন্তর্জাতিক নিউজ মনিটর' : 'Global news monitoring'}</h1>
          <p>{dict.tagline}</p>
        </div>
        <div className="monitor-stats">
          <div><strong>{total.toLocaleString()}</strong><span>{bn ? 'সংবাদ' : 'Stories'}</span></div>
          <div><strong>{activeSources.length}</strong><span>{bn ? 'সক্রিয় সোর্স' : 'Sources'}</span></div>
          <div><strong>{NEWS_PAGE_SIZE}</strong><span>{bn ? 'প্রতি পাতায়' : 'Per page'}</span></div>
        </div>
      </div>

      <CategoryChips active={category} stats={stats} query={{ q, source, date, from, to }} />

      <div className="monitor-filterbar">
        <div className="monitor-resultcount">
          {dict.showing} <strong>{items.length}</strong> {dict.of} <strong>{total}</strong> {dict.items}
        </div>
        <div className="monitor-filter-actions">
          <DateFilter date={date} from={from} to={to} />
          <details className="monitor-source-filter">
            <summary className="monitor-select" aria-label={dict.filterBySource}>
              {dict.filterBySource}: <strong>{source ?? dict.allCategories}</strong> <span aria-hidden>⌄</span>
            </summary>
            <div className="monitor-source-menu">
              <Link href={buildHref({ ...filters, source: undefined })}>{dict.allCategories}</Link>
              {sourceOptions.map((name) => (
                <Link href={buildHref({ ...filters, source: name })} key={name} aria-current={source === name ? 'page' : undefined}>{name}</Link>
              ))}
            </div>
          </details>
          {filtering ? (
            <Link href="/" className="monitor-clear-filters">{dict.clearFilters} ×</Link>
          ) : null}
        </div>
      </div>

      {filtering ? (
        <div className="active-filter-row" aria-label={bn ? 'নির্বাচিত ফিল্টার' : 'Selected filters'}>
          <span className="active-filter-label">{bn ? 'চালু ফিল্টার:' : 'Active filters:'}</span>
          {category !== 'All' ? <Link href={buildHref({ ...filters, category: 'All' })} className="active-filter-pill">{category} <span aria-hidden>×</span></Link> : null}
          {source ? <Link href={buildHref({ ...filters, source: undefined })} className="active-filter-pill">{source} <span aria-hidden>×</span></Link> : null}
          {date && date !== 'all' ? <Link href={buildHref({ ...filters, date: undefined, from: undefined, to: undefined })} className="active-filter-pill">{date === 'custom' ? [from, to].filter(Boolean).join(' → ') || 'Custom' : date} <span aria-hidden>×</span></Link> : null}
          {q ? <Link href={buildHref({ ...filters, q: undefined })} className="active-filter-pill">{q} <span aria-hidden>×</span></Link> : null}
          <Link href="/" className="active-filter-clear">{bn ? 'সব মুছুন' : 'Clear all'}</Link>
        </div>
      ) : null}

      <NewsDashboard items={items} sources={sourcesResult.sources}>
        <Pagination page={page} totalPages={totalPages} query={filters} />
      </NewsDashboard>
    </div>
  );
}
