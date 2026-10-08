import Link from 'next/link';
import { categoryColor } from '@/lib/format';
import { categoryLabel, t } from '@/lib/i18n';
import { CATEGORIES, type CategoryStat } from '@/lib/types';

function buildHref(base: { q?: string; source?: string }, category?: string): string {
  const params = new URLSearchParams();
  if (category && category !== 'All') params.set('category', category);
  if (base.q) params.set('q', base.q);
  if (base.source) params.set('source', base.source);
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

export function CategoryChips({
  active,
  stats,
  query,
}: {
  active: string;
  stats: CategoryStat[];
  query: { q?: string; source?: string };
}) {
  const dict = t();
  const counts = new Map(stats.map((s) => [s.category, s.item_count]));
  const total = stats.reduce((sum, s) => sum + s.item_count, 0);

  const chips: Array<{ key: string; label: string; count: number | undefined; color?: string }> = [
    { key: 'All', label: dict.allCategories, count: total || undefined },
    ...CATEGORIES.filter((c) => (counts.get(c) ?? 0) > 0 || c === active).map((c) => ({
      key: c,
      label: categoryLabel(c),
      count: counts.get(c),
      color: categoryColor(c),
    })),
  ];

  return (
    <nav aria-label={dict.filterByCategory} className="chip-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
      {chips.map((chip) => {
        const isActive = chip.key === active || (chip.key === 'All' && (!active || active === 'All'));
        return (
          <Link
            key={chip.key}
            href={buildHref(query, chip.key)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              isActive
                ? 'border-transparent bg-ink text-bg'
                : 'border-line bg-surface text-ink hover:border-accent hover:text-accent'
            }`}
          >
            {chip.color ? (
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ background: isActive ? 'currentColor' : chip.color }}
              />
            ) : null}
            {chip.label}
            {typeof chip.count === 'number' ? (
              <span className={`text-[11px] tabular-nums ${isActive ? 'opacity-70' : 'text-muted'}`}>{chip.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
