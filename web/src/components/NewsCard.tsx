import { categoryColor, hostname, relativeTime, sourceMonogram } from '@/lib/format';
import { categoryLabel, t } from '@/lib/i18n';
import type { NewsItem } from '@/lib/types';

export function NewsCard({ item, featured = false }: { item: NewsItem; featured?: boolean }) {
  const color = categoryColor(item.category);
  const dict = t();
  const published = relativeTime(item.published_at ?? item.created_at);

  return (
    <article className={`card group flex flex-col overflow-hidden ${featured ? 'sm:col-span-2' : ''}`}>
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="flex h-full flex-col"
        title={`${item.title} — ${hostname(item.link)}`}
      >
        <div className="relative">
          {item.image_url ? (
            // Plain <img>: image hosts vary per publisher, and next/image would
            // need every domain allow-listed. Lazy-loaded, fixed aspect ratio.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className={`w-full object-cover ${featured ? 'h-56 sm:h-64' : 'h-40'}`}
            />
          ) : (
            <div
              className={`flex w-full items-center justify-center ${featured ? 'h-36 sm:h-44' : 'h-24'}`}
              style={{ background: `linear-gradient(135deg, ${color}22, ${color}0d)` }}
            >
              <span className="headline text-2xl font-bold tracking-tight" style={{ color }}>
                {sourceMonogram(item.source_name)}
                <span className="ml-2 text-sm font-medium opacity-70">{item.source_name}</span>
              </span>
            </div>
          )}
          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide backdrop-blur"
            style={{ background: `${color}d9`, color: '#fff' }}
          >
            {categoryLabel(item.category)}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h2 className={`headline font-semibold text-ink ${featured ? 'text-2xl sm:text-[28px]' : 'text-[17px]'}`}>
            {item.title}
          </h2>

          {item.summary ? (
            <p className={`text-muted ${featured ? 'line-clamp-3 text-[15px]' : 'line-clamp-2 text-[13.5px]'}`}>
              {item.summary}
            </p>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-[12px] text-muted">
            <span className="font-semibold text-ink/80">{item.source_name}</span>
            {published ? <span aria-hidden>·</span> : null}
            {published ? <time dateTime={item.published_at ?? item.created_at}>{published}</time> : null}
            {item.author ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{item.author}</span>
              </>
            ) : null}
            <span className="ml-auto whitespace-nowrap font-medium" style={{ color }}>
              {dict.readAtSource} ↗
            </span>
          </div>
        </div>
      </a>
    </article>
  );
}
