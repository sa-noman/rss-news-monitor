import Link from 'next/link';
import { t } from '@/lib/i18n';

export function Footer({ sourceCount }: { sourceCount: number }) {
  const dict = t();
  return (
    <footer className="mt-12 border-t border-line bg-surface/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-[12.5px] text-muted sm:px-6">
        <p className="max-w-3xl">{dict.footerNote}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span>
            {dict.siteName} · {sourceCount} {dict.sourcesShort} · {dict.tagline}
          </span>
          <Link href="/sources" className="ml-auto hover:text-accent">
            {dict.sourceHealth}
          </Link>
          <Link href="/about" className="hover:text-accent">
            {dict.about}
          </Link>
        </div>
      </div>
    </footer>
  );
}
