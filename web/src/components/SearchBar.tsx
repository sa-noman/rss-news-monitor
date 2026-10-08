'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { t } from '@/lib/i18n';

/** GET search form. Keep live URL filters across client navigation. */
export function SearchBar({ defaultValue }: {
  defaultValue: string;
  hidden?: { category?: string; source?: string };
}) {
  const dict = t();
  const params = useSearchParams();
  const currentQuery = params.get('q') ?? defaultValue;
  const [query, setQuery] = useState(currentQuery);

  useEffect(() => { setQuery(currentQuery); }, [currentQuery]);

  const preserved = ['category', 'source', 'date', 'from', 'to']
    .map((key) => ({ key, value: params.get(key) }))
    .filter((pair): pair is { key: string; value: string } => Boolean(pair.value));

  return (
    <form action="/" method="get" role="search" className="monitor-search">
      {preserved.map(({ key, value }) => <input key={key} type="hidden" name={key} value={value} />)}
      <input type="search" name="q" value={query} onChange={(event) => setQuery(event.target.value)}
        placeholder={dict.searchPlaceholder} aria-label={dict.search} />
      <button type="submit">{dict.search}</button>
    </form>
  );
}
