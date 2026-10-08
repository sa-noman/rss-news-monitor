import Link from 'next/link';
import { t } from '@/lib/i18n';

export default function NotFound() {
  const dict = t();
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <p className="headline text-5xl font-bold text-ink">404</p>
      <p className="text-[14px] text-muted">{dict.noResults}</p>
      <Link href="/" className="rounded-full bg-ink px-4 py-1.5 text-[13px] font-semibold text-bg">
        {dict.latest}
      </Link>
    </div>
  );
}
