import Link from 'next/link';
import { categoryColor } from '@/lib/format';
import { categoryLabel, t } from '@/lib/i18n';
import { CATEGORIES, type CategoryStat } from '@/lib/types';

type Query = { q?: string; source?: string; date?: string; from?: string; to?: string };

function buildHref(base: Query, category?: string): string {
  const params = new URLSearchParams();
  if (category && category !== 'All') params.set('category', category);
  if (base.q) params.set('q', base.q);
  if (base.source) params.set('source', base.source);
  if (base.date && base.date !== 'all') params.set('date', base.date);
  if (base.date === 'custom') {
    if (base.from) params.set('from', base.from);
    if (base.to) params.set('to', base.to);
  }
  const qs = params.toString();
  return qs ? '/?' + qs : '/';
}

export function CategoryChips({ active, stats, query }: {
  active: string;
  stats: CategoryStat[];
  query: Query;
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
    <nav aria-label={dict.filterByCategory} className="chip-row monitor-chips">
      {chips.map((chip) => {
        const isActive = chip.key === active || (chip.key === 'All' && (!active || active === 'All'));
        return (
          <Link key={chip.key} href={buildHref(query, chip.key)}
            aria-current={isActive ? 'page' : undefined}
            className={'monitor-chip ' + (chip.color ? 'is-colored ' : 'is-all ') + (isActive ? 'is-selected' : '')}
            style={chip.color ? { backgroundColor: chip.color, borderColor: chip.color, color: '#fff' } : undefined}
          >
            <span>{chip.label}</span>
            {typeof chip.count === 'number' ? <span className="monitor-chip-count">{chip.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
