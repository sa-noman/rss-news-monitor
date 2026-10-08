'use client';

import { useEffect, useState } from 'react';
import { t } from '@/lib/i18n';

/** GET search form. Keeps the URL's existing filters when submitting. */
export function SearchBar({ defaultValue, hidden }: {
  defaultValue: string;
  hidden?: { category?: string; source?: string };
}) {
  const dict = t();
  const [query, setQuery] = useState(defaultValue);
  const [existing, setExisting] = useState<Record<string, string>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get('q') ?? defaultValue);
    const previous: Record<string, string> = {};
    for (const key of ['category', 'source', 'date', 'from', 'to']) {
      const value = params.get(key);
      if (value) previous[key] = value;
    }
    setExisting(previous);
  }, [defaultValue]);

  const kept = { ...hidden, ...existing };
  return (
    <form action="/" method="get" role="search" className="monitor-search">
      {Object.entries(kept).map(([key, value]) => value ? <input key={key} type="hidden" name={key} value={value} /> : null)}
      <input type="search" name="q" value={query} onChange={(event) => setQuery(event.target.value)}
        placeholder={dict.searchPlaceholder} aria-label={dict.search} />
      <button type="submit">{dict.search}</button>
    </form>
  );
}
