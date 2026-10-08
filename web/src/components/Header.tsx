import Link from 'next/link';
import { Suspense } from 'react';
import { t } from '@/lib/i18n';
import { LiveUpdates } from './LiveUpdates';
import { SearchBar } from './SearchBar';
import { ThemeToggle } from './ThemeToggle';
import { ScrollHeaderBehavior } from './ScrollHeaderBehavior';

export function Header({ sourceCount, query }: {
  sourceCount: number;
  query: { q?: string; category?: string; source?: string };
}) {
  const dict = t();
  return (
    <header className="monitor-site-header">
      <ScrollHeaderBehavior />
      <div className="monitor-header-inner">
        <div className="monitor-brand-row">
          <div id="monitor-category-trigger" className="monitor-category-header-slot" />
          <Link href="/" className="monitor-brand headline">Global News Monitor</Link>
          <nav className="monitor-top-nav" aria-label="Main navigation">
            <Link href="/">{dict.latest}</Link>
            <Link href="/sources">{dict.sourceHealth}</Link>
            <Link href="/about">{dict.about}</Link>
          </nav>
          <div className="monitor-header-actions">
            <span className="monitor-source-number">{sourceCount} {dict.sourcesShort}</span>
            <LiveUpdates labels={{
              live: dict.live, connecting: dict.connecting, off: dict.realtimeOff,
              newStories: dict.newStories, hint: dict.refreshHint,
            }} />
            <ThemeToggle />
          </div>
        </div>
        <div className="monitor-header-secondary">
          <div className="monitor-search-filter-group">
          <Suspense fallback={<div className="monitor-search" aria-hidden><input disabled placeholder={dict.searchPlaceholder} /><button disabled>{dict.search}</button></div>}>
            <SearchBar defaultValue={query.q ?? ''} />
          </Suspense>
          <div id="monitor-header-filter-slot" className="monitor-header-filter-slot" />
          </div>
        </div>
      </div>
    </header>
  );
}
