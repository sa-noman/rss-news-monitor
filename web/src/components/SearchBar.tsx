import { t } from '@/lib/i18n';

/** Plain GET form: search works even with JavaScript disabled. */
export function SearchBar({
  defaultValue,
  hidden,
}: {
  defaultValue: string;
  hidden?: { category?: string; source?: string };
}) {
  const dict = t();
  return (
    <form action="/" method="get" role="search" className="flex items-center gap-2">
      {hidden?.category ? <input type="hidden" name="category" value={hidden.category} /> : null}
      {hidden?.source ? <input type="hidden" name="source" value={hidden.source} /> : null}
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={dict.searchPlaceholder}
        aria-label={dict.search}
        className="h-9 w-full rounded-full border border-line bg-surface px-3.5 text-[13.5px] text-ink outline-none placeholder:text-muted focus:border-accent"
      />
      <button
        type="submit"
        className="h-9 shrink-0 rounded-full bg-ink px-4 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90"
      >
        {dict.search}
      </button>
    </form>
  );
}
