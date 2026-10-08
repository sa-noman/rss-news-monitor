import Link from 'next/link';
import { CategoryChips } from '@/components/CategoryChips';
import { ModeBanner } from '@/components/ModeBanner';
import { NewsCard } from '@/components/NewsCard';
import { Pagination } from '@/components/Pagination';
import { fetchCategoryStats, fetchNews, fetchSources, NEWS_PAGE_SIZE } from '@/lib/data';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const dict = t();

  const category = first(sp.category) ?? 'All';
  const source = first(sp.source);
  const q = first(sp.q);
  const page = Math.min(500, Math.max(1, Number.parseInt(first(sp.page) ?? '1', 10) || 1));

  const [news, stats, sourcesResult] = await Promise.all([
    fetchNews({ category, source, q, page }),
    fetchCategoryStats(),
    fetchSources(),
  ]);

  const { items, total, mode, error } = news;
  const totalPages = Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE));
  const filtering = Boolean((category && category !== 'All') || source || q);
  const featuredId = !filtering && page === 1 ? items[0]?.id : undefined;
  const activeSources = sourcesResult.sources.filter((s) => s.is_active);
  const sourceOptions = [...new Set([...activeSources.map((s) => s.name), ...items.map((i) => i.source_name)])].sort();

  return (
    <div className="flex flex-col gap-5">
      {mode === 'demo' ? <ModeBanner error={error} /> : null}

      <CategoryChips active={category} stats={stats} query={{ q, source }} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-muted">
        <span>
          {dict.showing} <strong className="text-ink tabular-nums">{items.length}</strong> {dict.of}{' '}
          <strong className="text-ink tabular-nums">{total}</strong> {dict.items}
        </span>

        <details className="relative">
          <summary className="cursor-pointer list-none rounded-full border border-line bg-surface px-3 py-1 font-medium hover:border-accent hover:text-accent">
            {dict.filterBySource}: <span className="text-ink">{source ?? dict.allCategories}</span>
          </summary>
          <div className="absolute z-20 mt-1 max-h-72 w-60 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-lg">
            <Link
              href={buildHref({ category, q })}
              className="block rounded-lg px-3 py-1.5 text-[13px] hover:bg-accent-soft"
            >
              {dict.allCategories}
            </Link>
            {sourceOptions.map((name) => (
              <Link
                key={name}
                href={buildHref({ category, q, source: name })}
                className={`block rounded-lg px-3 py-1.5 text-[13px] hover:bg-accent-soft ${
                  name === source ? 'font-semibold text-accent' : ''
                }`}
              >
                {name}
              </Link>
            ))}
          </div>
        </details>

        {filtering ? (
          <Link href="/" className="font-medium text-accent hover:underline">
            {dict.clearFilters} ✕
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-6 py-14 text-center">
          <p className="headline text-xl font-semibold text-ink">{dict.noResults}</p>
          <p className="mt-1 text-[13.5px] text-muted">{dict.noResultsHint}</p>
          <Link href="/" className="mt-4 inline-block rounded-full bg-ink px-4 py-1.5 text-[13px] font-semibold text-bg">
            {dict.clearFilters}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} featured={item.id === featuredId} />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} query={{ category, source, q }} />
    </div>
  );
}

function buildHref(query: { category?: string; q?: string; source?: string }): string {
  const params = new URLSearchParams();
  if (query.category && query.category !== 'All') params.set('category', query.category);
  if (query.source) params.set('source', query.source);
  if (query.q) params.set('q', query.q);
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}
