'use client';

import { useEffect, useState } from 'react';
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
    <CategorySidebar active={active} dict={dict} chips={chips} query={query} />
  );
}

function CategorySidebar({ active, dict, chips, query }: {
  active: string;
  dict: ReturnType<typeof t>;
  chips: Array<{ key: string; label: string; count: number | undefined; color?: string }>;
  query: Query;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="monitor-category-menu">
      <button type="button" className="monitor-category-toggle" aria-expanded={open}
        aria-controls="monitor-category-sidebar" onClick={() => setOpen(value => !value)}>
        <span className="monitor-category-menu-icon" aria-hidden>☰</span>
        <span>{dict.filterByCategory}</span>
        <span className="monitor-category-current">{active === 'All' ? dict.allCategories : categoryLabel(active)}</span>
        <span aria-hidden>{open ? '×' : '☰'}</span>
      </button>
      {open ? (
        <>
          <button type="button" className="monitor-category-backdrop" aria-label="Close category menu" onClick={() => setOpen(false)} />
          <aside id="monitor-category-sidebar" className="monitor-category-drawer" aria-label={dict.filterByCategory}>
            <div className="monitor-category-drawer-header">
              <div><h2>{dict.filterByCategory}</h2><p>{chips.length - 1} categories</p></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close categories">×</button>
            </div>
            <nav aria-label={dict.filterByCategory} className="monitor-category-options">
              {chips.map((chip) => {
                const isActive = chip.key === active || (chip.key === 'All' && (!active || active === 'All'));
                return (
                  <Link key={chip.key} href={buildHref(query, chip.key)}
                    aria-current={isActive ? 'page' : undefined}
                    className={'monitor-chip ' + (chip.color ? 'is-colored ' : 'is-all ') + (isActive ? 'is-selected' : '')}
                    style={chip.color ? { backgroundColor: `color-mix(in srgb, ${chip.color} 10%, var(--surface))`, borderColor: `color-mix(in srgb, ${chip.color} 24%, var(--border))`, color: chip.color } : undefined}>
                    <span>{chip.label}</span>
                    {typeof chip.count === 'number' ? <span className="monitor-chip-count">{chip.count}</span> : null}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      ) : null}
    </div>
  );
}
