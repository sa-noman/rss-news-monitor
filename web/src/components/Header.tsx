import Link from 'next/link';
import { t } from '@/lib/i18n';
import { LiveUpdates } from './LiveUpdates';
import { SearchBar } from './SearchBar';

export function Header({ sourceCount, query }: { sourceCount: number; query: { q?: string; category?: string; source?: string } }) {
  const dict = t();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="headline text-[22px] font-bold tracking-tight text-ink">
              {dict.siteName}
            </span>
            <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
          </Link>

          <nav className="flex items-center gap-3 text-[13px] font-medium text-muted">
            <Link href="/" className="hover:text-accent">
              {dict.latest}
            </Link>
            <Link href="/sources" className="hover:text-accent">
              {dict.sourceHealth}
            </Link>
            <Link href="/about" className="hover:text-accent">
              {dict.about}
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[12px] text-muted sm:inline">
              {sourceCount} {dict.sourcesShort}
            </span>
            <LiveUpdates
              labels={{ live: dict.live, connecting: dict.connecting, off: dict.realtimeOff, newStories: dict.newStories, hint: dict.refreshHint }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <p className="hidden text-[12.5px] text-muted md:block">{dict.tagline}</p>
          <div className="ml-auto w-full sm:w-80">
            <SearchBar defaultValue={query.q ?? ''} hidden={{ category: query.category, source: query.source }} />
          </div>
        </div>
      </div>
    </header>
  );
}
