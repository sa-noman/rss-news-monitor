import Link from 'next/link';
import { t } from '@/lib/i18n';

function href(page: number, query: { q?: string; category?: string; source?: string }): string {
  const params = new URLSearchParams();
  if (query.category && query.category !== 'All') params.set('category', query.category);
  if (query.source) params.set('source', query.source);
  if (query.q) params.set('q', query.q);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

export function Pagination({
  page,
  totalPages,
  query,
}: {
  page: number;
  totalPages: number;
  query: { q?: string; category?: string; source?: string };
}) {
  if (totalPages <= 1) return null;
  const dict = t();
  const linkClass = 'rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-medium text-ink hover:border-accent hover:text-accent';
  const disabledClass = 'rounded-full border border-line px-4 py-1.5 text-[13px] font-medium text-muted opacity-45';

  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label="pagination">
      {page > 1 ? (
        <Link href={href(page - 1, query)} className={linkClass} rel="prev">
          ← {dict.prev}
        </Link>
      ) : (
        <span className={disabledClass}>← {dict.prev}</span>
      )}
      <span className="text-[13px] text-muted tabular-nums">
        {dict.page} {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1, query)} className={linkClass} rel="next">
          {dict.next} →
        </Link>
      ) : (
        <span className={disabledClass}>{dict.next} →</span>
      )}
    </nav>
  );
}
